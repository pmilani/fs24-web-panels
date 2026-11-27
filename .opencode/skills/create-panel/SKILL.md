---
name: Create Panel
description: Add or extend a standalone DesktopXR flight-simulation panel view in this project, including its UI, optional configuration, telemetry, discovery, and verification.
---

# Add a panel view

Use this skill when adding a new view under `views/` or making a substantial change to a panel's structure, settings, or data requirements. Follow this workflow to implement the complete panel, not just a mockup.

## Before implementation: clarify the panel

1. Inspect `AGENTS.md`, `README.md`, `app.py`, and at least one existing view and its config page (if present). Check for existing assets and user changes before editing.
2. If the user has not already specified configuration, **ask them whether the panel needs user-configurable parameters** before implementing it. Use the question tool for a direct choice, for example:
   - **Yes** — ask which settings they want and their preferred defaults; suggest relevant examples based on the panel (format, units, visibility conditions, opacity, thresholds, refresh interval).
   - **No** — build the panel without a config page and use sensible built-in defaults.
   Do not silently invent user-facing settings or add a config page when the answer is no. If they already described settings or explicitly said there are none, do not ask again. Clarify ambiguous settings (including defaults and valid ranges) before coding.
3. Establish the panel slug, purpose, expected overlay size/behavior, data sources, and whether simulator telemetry is actually required. Make reasonable assumptions for details the user has not specified and state them briefly when useful.

## Project conventions

- Each view is a standalone folder at `views/<panel-slug>/`. The Python server serves files directly; there is no frontend framework or build step.
- The entry point is `views/<panel-slug>/index.html`. Keep view-specific `app.js`, `style.css`, and assets alongside it; reference them with absolute paths such as `/<panel-slug>/style.css`.
- `available_views()` in `app.py` discovers directories containing `index.html` and automatically adds a config URL when `config/index.html` exists. Add a human-friendly title and description to its maps when automatic slug formatting or the generic description is insufficient.
- A config page lives at `views/<panel-slug>/config/index.html`, uses `/<panel-slug>/config/...` asset URLs, and must link back to `/<panel-slug>/`. Follow the shared config-page styling/conventions of existing views.
- View pages must have a transparent background, compact overlay-friendly content, responsive sizing, and accessible semantic markup. Avoid unnecessary dependencies.
- Follow `AGENTS.md`: never use the HTML `hidden` attribute or `display: none` to hide panel elements. Keep elements rendered; hide using opacity, restore the configured opacity when shown, and update `aria-hidden` where appropriate. This avoids a DesktopXR rendering issue when hidden elements are shown again.
- Browser-only settings belong in `localStorage` under a unique key such as `desktopxr.<panel-slug>.config`. Define and validate defaults in both config and view code, tolerate missing/malformed saved data, and show a save/error status. Keep config controls usable in a narrow window.
- Client-side local time should use the host browser's local `Date` unless the user requests simulator time.

## Workflow

1. Use the confirmed slug consistently in file paths, routes, asset URLs, API paths, and the localStorage key. Preserve existing panel behavior and follow nearby code/style conventions.
2. Create the panel page and only the required assets. Include appropriate document metadata, viewport, title, semantic markup, and accessible labels/status. Keep the page useful while data is loading or unavailable.
3. If settings were requested, add the config page, styles, and script. Save changes immediately (or provide an explicit save action if appropriate); load the same settings and defaults in the panel; validate/clamp values; handle storage errors gracefully; and reflect saved/error state accessibly. Do not create config files/pages for a settings-free panel.
4. For simulator data, extend `Telemetry` with only the values required, subscribe to the necessary SimConnect data in `simconnect_reader()`, and expose it through an appropriately scoped JSON endpoint in `OverlayHandler`. Maintain thread-safe snapshots and no-store JSON responses. Handle disconnects, stale/missing values, and API errors without stopping the server or breaking the view. Do not add telemetry/backend changes for data available in the browser or unrelated to the request.
5. Add friendly title/description metadata in `available_views()` if needed. `views/index.html` is generated from discovered views; do not duplicate panel listings there. Update `README.md` with useful view/config URLs and behavior when appropriate.
6. Verify the result: run `.venv/Scripts/python.exe -m py_compile app.py` if Python changed; run `node --check <file>` for each changed JavaScript file when Node is available; inspect `available_views()` for the discovered route and automatic config link; and review the final diff for route consistency, accessible behavior, and prohibited hiding patterns. Report any checks that could not be run.

## Completion checklist

- The panel is served at `/<slug>/`; all page/config assets and links use matching absolute URLs.
- The user's answer about configuration is honored. If settings exist, config UI, persisted values, defaults, validation, and panel behavior agree; otherwise there is no unnecessary config page.
- The home page discovers the view and shows **CONFIGURE** only when its config entry page exists.
- The overlay remains transparent, responsive, legible at small sizes, and accessible.
- Any hide/show behavior uses opacity, never `hidden` or `display: none`.
- Simulator-dependent views handle unavailable, disconnected, or invalid telemetry gracefully without taking down the server.
- Relevant syntax/discovery checks have been run, and limitations are reported.
