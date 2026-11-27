"""Local web overlay server and MSFS SimConnect reader."""

from __future__ import annotations

import argparse
import configparser
import errno
import json
import logging
import mimetypes
import os
import re
import shutil
import tempfile
import time
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
STATIC_ROOT = (ROOT / "views").resolve()
POLL_TIMEOUT_SECONDS = 0.25
RECONNECT_DELAY_SECONDS = 3
PORT_FALLBACK_ATTEMPTS = 20
PANEL_SLOT_COUNT = 4

logging.basicConfig(
    level=os.environ.get("LOGLEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("desktopxr-overlay")


class Telemetry:
    """Thread-safe snapshot shared by the SimConnect reader and HTTP server."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state: dict[str, object] = {
            "connected": False,
            "rate": None,
            "engine_off": None,
            "updated_at": None,
            "message": "Starting SimConnect…",
        }

    def update(self, **values: object) -> None:
        with self._lock:
            self._state.update(values)

    def snapshot(self) -> dict[str, object]:
        with self._lock:
            return dict(self._state)


telemetry = Telemetry()
stop_reader = threading.Event()
databridge_lock = threading.Lock()


def available_views() -> list[dict[str, str]]:
    """Discover view pages from folders containing an index.html."""
    titles = {
        "simulation-rate": "Simulation Rate",
        "real-world-clock": "Real World Clock",
    }
    descriptions = {
        "simulation-rate": "Live simulation rate from Microsoft Flight Simulator.",
        "real-world-clock": "Host computer local time in a 24-hour digital display.",
    }
    views = []
    for folder in sorted(STATIC_ROOT.iterdir()):
        if folder.is_dir() and (folder / "index.html").is_file():
            slug = folder.name
            views.append(
                {
                    "name": titles.get(slug, slug.replace("-", " ").title()),
                    "description": descriptions.get(slug, "Flight simulation data view."),
                    "url": f"/{slug}/",
                    **(
                        {"config_url": f"/{slug}/config"}
                        if (folder / "config" / "index.html").is_file()
                        else {}
                    ),
                }
            )
    return views


def simconnect_reader() -> None:
    """Subscribe to simulation rate and wait for the simulator across restarts."""
    last_problem: str | None = None
    while not stop_reader.is_set():
        try:
            # Import on each attempt too: a missing DLL/package must not stop
            # the local overlay server or prevent later reconnection.
            from simconnect import PERIOD_SECOND, SimConnect

            with SimConnect(name="DesktopXR Simulation Rate", verbose=False) as connection:
                # SIMULATION RATE is an FS environment variable rather than a
                # catalogued SimVar, so specify its unit explicitly.
                definition = connection.subscribe_simdata(
                    [
                        {"name": "SIMULATION RATE", "units": "number"},
                        {"name": "NUMBER OF ENGINES", "units": "number"},
                        *(
                            {"name": f"GENERAL ENG COMBUSTION:{index}", "units": "bool"}
                            for index in range(1, 5)
                        ),
                    ],
                    period=PERIOD_SECOND,
                )
                telemetry.update(
                    connected=True,
                    rate=None,
                    engine_off=None,
                    updated_at=None,
                    message="Connected · waiting for simulator data",
                )
                logger.info("Connected to Microsoft Flight Simulator")
                last_problem = None

                while not stop_reader.is_set():
                    connection.receive(timeout_seconds=POLL_TIMEOUT_SECONDS)
                    rate = definition.simdata.get("SIMULATION RATE")
                    engine_count = definition.simdata.get("NUMBER OF ENGINES")
                    engine_off = None
                    if engine_count is not None and 1 <= int(engine_count) <= 4:
                        combustion = [
                            definition.simdata.get(f"GENERAL ENG COMBUSTION:{index}")
                            for index in range(1, int(engine_count) + 1)
                        ]
                        if all(value is not None for value in combustion):
                            engine_off = all(not bool(value) for value in combustion)

                    if rate is not None or engine_off is not None:
                        updates: dict[str, object] = {
                            "connected": True,
                            "engine_off": engine_off,
                            "message": "Connected",
                        }
                        if rate is not None:
                            updates["rate"] = float(rate)
                            updates["updated_at"] = time.time()
                        telemetry.update(**updates)
        except Exception as exc:
            problem = str(exc) or exc.__class__.__name__
            telemetry.update(
                connected=False,
                rate=None,
                engine_off=None,
                updated_at=None,
                message="SimConnect host not running · waiting",
            )
            # Keep the console useful without printing the same connection
            # failure every few seconds while the simulator is closed.
            if problem != last_problem:
                logger.debug("SimConnect host not running; waiting %s seconds before reconnecting (%s)", RECONNECT_DELAY_SECONDS, problem)
                last_problem = problem
            stop_reader.wait(RECONNECT_DELAY_SECONDS)


class OverlayHandler(BaseHTTPRequestHandler):
    server_version = "DesktopXROverlay/1.0"

    def do_GET(self) -> None:
        request_path = urlparse(self.path).path
        if request_path == "/api/databridge":
            self._send_json(200, read_databridge_config())
            return

        if request_path == "/api/status":
            state = telemetry.snapshot()
            state["views"] = available_views()
            body = json.dumps(state).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if request_path == "/api/simulation-rate":
            body = json.dumps(telemetry.snapshot()).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        relative_path = request_path.lstrip("/") or "index.html"
        target = (STATIC_ROOT / relative_path).resolve()
        if not target.is_relative_to(STATIC_ROOT):
            self.send_error(403, "Forbidden")
            return
        if target.is_dir():
            target = target / "index.html"
        if not target.is_file():
            self.send_error(404, "Not found")
            return

        body = target.read_bytes()
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in ("application/javascript",):
            content_type += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/databridge":
            self.send_error(404, "Not found")
            return

        # Config editing is local-machine functionality; don't expose it if the
        # server was deliberately bound to a network interface.
        try:
            import ipaddress

            if not ipaddress.ip_address(self.client_address[0]).is_loopback:
                self.send_error(403, "Local requests only")
                return
        except ValueError:
            self.send_error(403, "Local requests only")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 64 * 1024:
                raise ValueError("Invalid request size")
            payload = json.loads(self.rfile.read(length))
            slots = validate_databridge_slots(payload)
            result = write_databridge_config(slots)
        except (ValueError, json.JSONDecodeError) as exc:
            self._send_json(400, {"error": str(exc)})
            return
        except (OSError, configparser.Error) as exc:
            logger.exception("Could not update DesktopXR DataBridge config")
            self._send_json(500, {"error": str(exc) or "Could not update the config file"})
            return

        self._send_json(200, result)

    def _send_json(self, status: int, value: object) -> None:
        body = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format_string: str, *args: object) -> None:
        logger.debug("%s - %s", self.address_string(), format_string % args)


def databridge_ini_path() -> Path | None:
    appdata = os.environ.get("APPDATA")
    if not appdata:
        return None
    return Path(appdata) / "DesktopXR" / "DesktopXR-DataBridge.ini"


def read_ini_text(path: Path) -> tuple[str, str]:
    raw = path.read_bytes()
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        encoding = "utf-16"
    elif raw.startswith(b"\xef\xbb\xbf"):
        encoding = "utf-8-sig"
    else:
        encoding = "utf-8"
    return raw.decode(encoding), encoding


def read_databridge_config() -> dict[str, object]:
    path = databridge_ini_path()
    if path is None:
        return {"available": False, "path": None, "slots": [], "views": available_views(), "error": "The APPDATA folder could not be located."}
    if not path.is_file():
        return {
            "available": False,
            "path": str(path),
            "slots": [],
            "views": available_views(),
            "error": "DataBridge config file not found. Check that DesktopXR is installed for this Windows user.",
        }

    parser = configparser.ConfigParser(interpolation=None)
    try:
        contents, _encoding = read_ini_text(path)
        parser.read_string(contents)
        section = parser["WebOverlays"] if parser.has_section("WebOverlays") else {}
        slots = []
        for index in range(1, PANEL_SLOT_COUNT + 1):
            enabled = str(section.get(f"web{index}_enabled", "0")).strip().lower() in ("1", "true", "yes", "on")
            slots.append(
                {
                    "enabled": enabled,
                    "url": str(section.get(f"web{index}_url", "")).strip(),
                    "width": str(section.get(f"web{index}_width", "")).strip(),
                    "height": str(section.get(f"web{index}_height", "")).strip(),
                }
            )
    except (OSError, configparser.Error, UnicodeError) as exc:
        return {"available": False, "path": str(path), "slots": [], "views": available_views(), "error": f"Could not read the DataBridge config: {exc}"}

    return {"available": True, "path": str(path), "slots": slots, "views": available_views(), "error": None}


def validate_databridge_slots(payload: object) -> list[dict[str, object]]:
    if not isinstance(payload, dict) or not isinstance(payload.get("slots"), list):
        raise ValueError("Expected settings for all four panel slots.")
    raw_slots = payload["slots"]
    if len(raw_slots) != PANEL_SLOT_COUNT:
        raise ValueError(f"Exactly {PANEL_SLOT_COUNT} panel slots are required.")

    slots = []
    for index, raw_slot in enumerate(raw_slots, start=1):
        if not isinstance(raw_slot, dict) or not isinstance(raw_slot.get("enabled"), bool):
            raise ValueError(f"Panel {index}: invalid enabled setting.")
        url = raw_slot.get("url", "")
        if not isinstance(url, str):
            raise ValueError(f"Panel {index}: URL must be text.")
        url = url.strip()
        if any(char in url for char in "\r\n"):
            raise ValueError(f"Panel {index}: URL cannot contain line breaks.")
        if url:
            parsed = urlparse(url)
            if parsed.scheme not in ("http", "https") or not parsed.netloc or not parsed.hostname:
                raise ValueError(f"Panel {index}: enter a complete http:// or https:// URL.")
        if raw_slot["enabled"] and not url:
            raise ValueError(f"Panel {index}: choose a panel URL or turn the slot off.")

        dimensions: dict[str, str] = {}
        for dimension in ("width", "height"):
            value = raw_slot.get(dimension, "")
            if not isinstance(value, (str, int)) or isinstance(value, bool):
                raise ValueError(f"Panel {index}: {dimension} must be a whole number or blank.")
            value = str(value).strip()
            if value and (not value.isdecimal() or not 1 <= int(value) <= 10000):
                raise ValueError(f"Panel {index}: {dimension} must be between 1 and 10000 pixels.")
            dimensions[dimension] = value

        slots.append({"enabled": raw_slot["enabled"], "url": url, **dimensions})
    return slots


def replace_web_overlays_section(text: str, slots: list[dict[str, object]]) -> str:
    newline = "\r\n" if "\r\n" in text else "\n"
    lines = text.splitlines(keepends=True)
    section_start = next(
        (
            index
            for index, line in enumerate(lines)
            if re.match(r"^\s*\[WebOverlays\]\s*(?:[;#].*)?$", line.strip(), re.IGNORECASE)
        ),
        None,
    )

    values: dict[str, str] = {}
    for index, slot in enumerate(slots, start=1):
        values.update(
            {
                f"web{index}_enabled": "1" if slot["enabled"] else "0",
                f"web{index}_url": str(slot["url"]),
                f"web{index}_width": str(slot["width"]),
                f"web{index}_height": str(slot["height"]),
            }
        )

    if section_start is None:
        if text and not text.endswith(("\n", "\r")):
            text += newline
        if text.strip():
            text += newline
        text += "[WebOverlays]" + newline
        return text + "".join(f"{key}={value}{newline}" for key, value in values.items())

    section_end = len(lines)
    for index in range(section_start + 1, len(lines)):
        if re.match(r"^\s*\[[^\]]+\]", lines[index].strip()):
            section_end = index
            break

    found: set[str] = set()
    key_pattern = re.compile(r"^(\s*)(web[1-4]_(?:enabled|url|width|height))(\s*=\s*)(.*)$", re.IGNORECASE)
    for index in range(section_start + 1, section_end):
        line = lines[index]
        content = line.rstrip("\r\n")
        ending = line[len(content):]
        match = key_pattern.match(content)
        if match:
            key = match.group(2).lower()
            inline_comment = re.search(r"\s+[;#].*$", match.group(4))
            suffix = inline_comment.group(0) if inline_comment else ""
            lines[index] = f"{match.group(1)}{match.group(2)}{match.group(3)}{values[key]}{suffix}{ending}"
            found.add(key)

    missing = [(key, value) for key, value in values.items() if key not in found]
    if missing:
        insertion = section_end
        while insertion > section_start + 1 and not lines[insertion - 1].strip():
            insertion -= 1
        if insertion > 0 and not lines[insertion - 1].endswith(("\n", "\r")):
            lines[insertion - 1] += newline
        additions = [f"{key}={value}{newline}" for key, value in missing]
        lines[insertion:insertion] = additions

    return "".join(lines)


def write_databridge_config(slots: list[dict[str, object]]) -> dict[str, object]:
    path = databridge_ini_path()
    if path is None or not path.is_file():
        raise OSError("DataBridge config file was not found; no changes were made.")

    with databridge_lock:
        current, encoding = read_ini_text(path)
        updated = replace_web_overlays_section(current, slots)
        backup = path.with_name(path.name + ".bak")
        shutil.copy2(path, backup)

        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", encoding=encoding, newline="", dir=path.parent, delete=False
            ) as temporary:
                temporary.write(updated)
                temporary_path = Path(temporary.name)
            os.replace(temporary_path, path)
        finally:
            if temporary_path is not None and temporary_path.exists():
                temporary_path.unlink()

    return {"saved": True, "path": str(path), "backup": str(backup), "slots": slots}


def create_server(host: str, port: int) -> ThreadingHTTPServer:
    """Bind the requested port, falling forward if Windows has reserved it."""
    last_error: OSError | None = None
    for candidate in range(port, min(port + PORT_FALLBACK_ATTEMPTS + 1, 65536)):
        try:
            return ThreadingHTTPServer((host, candidate), OverlayHandler)
        except OSError as exc:
            winerror = getattr(exc, "winerror", None)
            if exc.errno not in (errno.EADDRINUSE, errno.EACCES) and winerror not in (10013, 10048):
                raise
            last_error = exc

    raise OSError(
        f"Could not bind {host} on ports {port}-{min(port + PORT_FALLBACK_ATTEMPTS, 65535)}. "
        "Try another port with --port (for example: python app.py --port 9000)."
    ) from last_error


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve DesktopXR flight-sim overlays")
    parser.add_argument("--host", default="127.0.0.1", help="Bind address (default: localhost)")
    parser.add_argument("--port", type=int, default=8765, help="HTTP port (default: 8765)")
    args = parser.parse_args()

    reader = threading.Thread(target=simconnect_reader, name="simconnect-reader", daemon=True)
    reader.start()

    server = create_server(args.host, args.port)
    server.daemon_threads = True
    actual_port = server.server_address[1]
    if actual_port != args.port:
        logger.warning("Port %s unavailable; using port %s instead", args.port, actual_port)
    overlay_host = "127.0.0.1" if args.host in ("0.0.0.0", "") else args.host
    logger.info("Home page: http://%s:%s/", overlay_host, actual_port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Stopping overlay server")
    finally:
        stop_reader.set()
        server.server_close()
        reader.join(timeout=2)


if __name__ == "__main__":
    main()
