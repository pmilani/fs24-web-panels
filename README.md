# DesktopXR Flight Sim Overlay

A small local Python web app for transparent DesktopXR overlays. It reads live simulator data through SimConnect and serves one standalone page per view.

## Simulation-rate view

- Home page: `http://127.0.0.1:8765/` (SimConnect status and discovered views)
- View: `http://127.0.0.1:8765/simulation-rate/`
- Status and view list: `http://127.0.0.1:8765/api/status`
- JSON telemetry: `http://127.0.0.1:8765/api/simulation-rate`
- DesktopXR DataBridge panel settings: `http://127.0.0.1:8765/api/databridge`
- The page has a transparent background and polls the local endpoint once per second.
- The SimConnect reader subscribes to FS2024's `SIMULATION RATE` environment variable and engine combustion state at the SDK's one-second period. Config options are saved in the browser. No Node.js build or browser dependencies are required.

## Real-world clock

- View: `http://127.0.0.1:8765/real-world-clock/`
- Config: `http://127.0.0.1:8765/real-world-clock/config`
- Displays the host computer's local time in 24-hour `HH:MM` format, with a smaller type size than the Simulation Rate view.
- The format can be changed to 12-hour AM/PM on the config page.

## Run on Windows

Use 64-bit Python 3.10 or newer and start Microsoft Flight Simulator 2024. The easiest option is to run `run.bat` from File Explorer, or `run.bat --port 9000` from Command Prompt. In PowerShell, use `.\run.bat` (or `.\run.bat --port 9000`). The launcher creates a virtual environment if needed, installs the requirements, and starts the server.

To add a desktop shortcut, right-click `run.bat` in File Explorer and choose **Show more options → Send to → Desktop (create shortcut)**. Rename the shortcut if you like, then double-click it to start the app. Its console window stays open while the server is running.

To set everything up manually from PowerShell, run:

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

The app prints its home page URL at startup (normally `http://127.0.0.1:8765/`); use that page to check connection status and browse views. Add `http://127.0.0.1:8765/simulation-rate/` as a web overlay in DesktopXR. The server binds to localhost by default and automatically tries the next 20 ports if Windows has reserved the requested one. To choose another starting port, run `python app.py --port 9000`.

The home page can also manage the four DesktopXR DataBridge WebOverlays slots. It reads `%APPDATA%\DesktopXR\DesktopXR-DataBridge.ini`; choosing a local view or entering a custom URL registers and enables that slot. Uncheck **Enabled** to keep a panel configured but inactive. **Advanced Options** reveals the panel address and optional width and height fields; it starts unchecked. Saving updates only the `[WebOverlays]` section and keeps the previous file as `DesktopXR-DataBridge.ini.bak`. Use **Reload file** to discard unsaved edits and read settings changed elsewhere.

`pysimconnect` provides the Python wrapper and a SimConnect DLL. If you want to use a specific DLL from your installed FS2024 SDK, set `SIMCONNECT_DLL` to its full path before launching the app. The overlay server stays running if the SimConnect host is not running. It checks the connection every few seconds, so you can start, close, and relaunch FS2024 without restarting this app; the page shows its connection state while waiting.

## Adding a view

Create another directory under `views/` with an `index.html` and its own assets. It will be served at `http://127.0.0.1:8765/<directory-name>/`. Add data to `Telemetry` and a corresponding API endpoint in `app.py` when that view needs more simulator values.
