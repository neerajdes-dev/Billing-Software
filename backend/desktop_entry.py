"""
Entry point for the packaged desktop backend (see backend/packaging/backend.spec).

This is a separate file from main.py on purpose: main.py stays the exact
entrypoint the web deploy already uses (`uvicorn main:app`, per render.yaml),
untouched by anything desktop-specific. This file is what PyInstaller
targets to produce billing-backend.exe -- a single script that runs the same
`main:app` ASGI application via uvicorn's Python API instead of its CLI, so
the packaged executable needs no `uvicorn` command on the shop PC's PATH at
all.

Electron's main process (desktop/main/backend-manager.js) spawns this
(packaged: the .exe directly; dev mode: `python backend/desktop_entry.py`
against the repo's own backend/) and passes configuration entirely through
environment variables -- there is no .env file shipped with the desktop
app, since Electron builds the child process's environment explicitly for
every launch (see backend-manager.js for what it sets):

  BILLING_LOCAL_PORT   - required. TCP port to bind on 127.0.0.1. Electron
                          picks a free ephemeral port at launch and passes it
                          here, to avoid colliding with anything else running
                          on the shop's PC.
  DATABASE_URL          - required. Always a sqlite:/// URL for the desktop
                          app, pointed at a file under the OS's per-user app
                          data directory (see backend-manager.js).
  SECRET_KEY             - required. Generated once by Electron on first
                          launch and persisted locally, so restarting the
                          app doesn't invalidate every previously-issued
                          login session.
  JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, CORS_ORIGINS
                          - same meaning as the web deploy's env vars
                          (backend/.env.example); Electron sets sensible
                          desktop-appropriate defaults for these.

main.py already reads all of the above the same way it does for the web
deploy (via database.py's build_database_url() and main.py's own
os.getenv() calls) -- nothing in main.py needed to change to support this;
it just needs these variables present in its process environment, which is
exactly what a spawned child process gets from Electron.

  FRONTEND_DIST_DIR      - optional. When set, this process also serves the
                          built frontend (frontend/dist -- see
                          desktop/scripts/build-frontend.mjs) from the same
                          process and the same local port as the API,
                          mounted at "/app" (see _mount_frontend_if_configured
                          below for why "/app" and not "/"). Electron's
                          BrowserWindow then loads http://127.0.0.1:<port>/app/
                          instead of a file:// path.

                          This isn't just a convenience: Chromium refuses,
                          for CORS reasons, to load ES module <script> tags
                          (which is what Vite's build output always uses)
                          from a file:// origin at all -- confirmed while
                          testing this build in isolation, every asset
                          request came back "blocked by CORS policy...
                          only supported for protocol schemes: chrome,
                          chrome-extension, ..., http, https, ...". Serving
                          the same static files over a real http:// origin
                          (this one) avoids that restriction entirely, and
                          as a second benefit puts the frontend and the API
                          on the exact same origin (same scheme+host+port),
                          so the desktop app needs no CORS configuration at
                          all between them -- unlike the web deploy, where
                          the Vercel frontend and Render backend are
                          necessarily different origins and CORS_ORIGINS
                          exists specifically to bridge that.
"""

import os

import uvicorn

# Imported directly (rather than passed to uvicorn.run() as the string
# "main:app") so PyInstaller's static import-graph analysis actually sees
# and bundles main.py and everything it imports. uvicorn's string form
# resolves the module dynamically at runtime via importlib, which
# PyInstaller's analyzer cannot trace -- the packaged exe would build
# successfully but fail at startup with "Could not import module main"
# since main.py was never included in the bundle. Passing the already-
# imported ASGI `app` object directly avoids that entirely.
import main as _main_module


def _mount_frontend_if_configured() -> None:
    frontend_dist = os.environ.get("FRONTEND_DIST_DIR", "").strip()
    if not frontend_dist:
        return

    from fastapi.staticfiles import StaticFiles

    # Mounted at "/app", not "/": main.py already has its own
    # `@app.get("/")` (a small JSON status message, used by the web
    # deploy) registered before this ever runs, and Starlette matches
    # routes in registration order -- a mount added here at "/" would
    # never actually be reached for that exact path, since the earlier
    # route always wins first. "/app" has no such conflict with anything
    # in main.py's existing route table.
    #
    # html=True makes StaticFiles serve "/app/"'s index.html automatically,
    # which is the only server-side routing the desktop app needs at all:
    # the frontend uses HashRouter (see frontend/src/AppRouter.js)
    # specifically so that every other "route" (e.g. "#/dashboard") is a
    # URL fragment resolved entirely client-side in JavaScript and never
    # sent to this server as part of the request path -- so there's no
    # SPA-fallback-for-unknown-paths logic to write here at all.
    _main_module.app.mount(
        "/app",
        StaticFiles(directory=frontend_dist, html=True),
        name="desktop-frontend",
    )


def main() -> None:
    port_raw = os.environ.get("BILLING_LOCAL_PORT", "").strip()
    if not port_raw:
        raise SystemExit(
            "BILLING_LOCAL_PORT is not set. This entrypoint is meant to be "
            "launched by the desktop app's Electron main process, which "
            "picks a free local port and passes it in -- see "
            "desktop/main/backend-manager.js. For local testing you can "
            "also set it manually, e.g.: BILLING_LOCAL_PORT=8811 "
            "DATABASE_URL=sqlite:///./dev.db python desktop_entry.py"
        )

    port = int(port_raw)

    _mount_frontend_if_configured()

    # host is always 127.0.0.1, never 0.0.0.0: this backend only ever needs
    # to be reachable from the Electron renderer running on the same
    # machine, and binding to all interfaces would needlessly expose a JWT
    # login and full business database on the shop's local network.
    uvicorn.run(_main_module.app, host="127.0.0.1", port=port, log_level="info")


if __name__ == "__main__":
    main()
