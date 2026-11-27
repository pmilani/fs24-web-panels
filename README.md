# DesktopXR Flight Sim Overlay

I play Microsoft Flight Simulator 2024 in virtual reality. Before long, I ran into the kind of small frustrations that can build up and spoil the experience.
The one that stands out most is not being able to see the simulation rate (sim rate) at a glance in VR,
which for some obscure reason the developers decided not to show anywhere.
Keeping track of the sim rate is vital, to monitor accelerated flight phases for unexpected autopilot behavior 
and avoid missing ATC communications. (A common workaround is the timer trick: start a timer on the EFB and watch how 
quickly its seconds tick by)

Another frustration is occasionally needing to switch to the desktop view.
That means taking off the headset, putting on my glasses, and turning to face the monitor.
DesktopXR solves these issues, providing a desktop view and up to four custom panels in VR through its DataBridge.
This project provides views designed to work with those panels.
It currently includes two views, and more can be added—including with the AI skill included in this project.

After enabling the panels, use DesktopXR's documented controls to position them where you need them.

This is a small local Python web app for transparent DesktopXR overlays.
It reads live simulator data through SimConnect and serves one standalone page per view.

## Built-in views

- **Simulation Rate:** Displays the current simulation-rate multiplier as text (1x, 2x ...)
- **Real World Clock:** Displays your local time (your system clock), so you remember to go to sleep ;) with 24-hour and AM/PM formats.

## Installation

### Easy setup (recommended)

1. Install 64-bit Python 3.10 or newer.
2. Start the app using one of these options:
   - Double-click `run.bat` in File Explorer.
   - From Command Prompt, run `run.bat` (or `run.bat --port 9000` to choose a port).
   - From PowerShell, run `.\run.bat` (or `.\run.bat --port 9000`).

The launcher creates a virtual environment if needed, installs the requirements, and starts the server. To add a desktop shortcut, right-click `run.bat` in File Explorer and choose **Show more options → Send to → Desktop (create shortcut)**. Rename the shortcut if you like, then double-click it to start the app. Its console window stays open while the server is running.

### Manual setup

Use this option if you prefer to create the virtual environment and install dependencies yourself. In PowerShell, from the project directory, run:

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

## Running

Ensure DesktopXR DataBridge is running.

Open the home page at `http://127.0.0.1:8765/` to check the connection status, browse available views, and configure your DataBridge panels. 
Once a VR session is running, DataBridge will allow to reposition the overlay panels, as per DesktopXR's documented controls.
If you don't see the overlays, in the DesktopXR Configurator ensure you have enabled WebOverlays.

ℹ️ You can launch the DesktopXR Companion app to double check the overlays are showing, and reposition them.

💡Every once in a while, if you take off the headset and it goes to sleep the overlays can loose the centering: I recommend configuring a shortcut 
in DesktopXR itself for its `Recenter VR` function.

Start Microsoft Flight Simulator 2024.

ℹ️The SimConnect connection status should update automatically, as soon as FS2024 has completed its startup


## Developer notes

### Adding a view

Use the included **Create Panel** AI skill (`.opencode/skills/create-panel/SKILL.md`) to add a view. Describe the panel you want and whether it needs configurable settings; the skill will guide the implementation.

### Server and DataBridge

The server binds to localhost by default and automatically tries the next 20 ports if Windows has reserved the requested one. To choose another starting port, run `python app.py --port 9000`.

The home page manages the four DesktopXR DataBridge WebOverlays slots. It reads `%APPDATA%\DesktopXR\DesktopXR-DataBridge.ini`; choosing a local view or entering a custom URL registers and enables that slot. Uncheck **Enabled** to keep a panel configured but inactive. **Advanced Options** reveals the panel address and optional width and height fields; it starts unchecked. Saving updates only the `[WebOverlays]` section and keeps the previous file as `DesktopXR-DataBridge.ini.bak`. Use **Reload file** to discard unsaved edits and read settings changed elsewhere.

### SimConnect

`pysimconnect` provides the Python wrapper and a SimConnect DLL. If you want to use a specific DLL from your installed FS2024 SDK, set `SIMCONNECT_DLL` to its full path before launching the app. The overlay server stays running if the SimConnect host is not running. It checks the connection every few seconds, so you can start, close, and relaunch FS2024 without restarting this app; the page shows its connection state while waiting.

### Implementing a view

Create a directory under `views/` with an `index.html` and any view-specific assets. The server discovers it and serves it at `http://127.0.0.1:8765/<directory-name>/`. When the view needs additional simulator data, add the required values to `Telemetry` and expose them through a corresponding API endpoint in `app.py`.

### Existing view internals

The Simulation Rate view is served at `/simulation-rate/` and reads `/api/simulation-rate`; it polls once per second. The SimConnect reader subscribes to FS2024's `SIMULATION RATE` environment variable and engine combustion state at the SDK's one-second period. Its browser configuration is available at `/simulation-rate/config` and is stored in localStorage. The Real World Clock view is served at `/real-world-clock/`, with configuration at `/real-world-clock/config`.

The app also provides `/api/status` for connection status and discovered views, and `/api/databridge` for DesktopXR DataBridge panel settings. No Node.js build or browser dependencies are required.
