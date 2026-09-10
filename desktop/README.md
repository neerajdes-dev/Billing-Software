# Billing 24x7 Desktop (Phase A -- standalone, offline)

Windows desktop build of Resolvent Billing Software. Reuses the existing
`backend/` (FastAPI) and `frontend/` (React/Vite) projects unchanged, wrapped
in Electron with a local SQLite database. Fully offline: its own local
Admin login is created on first run, with zero connection to any cloud
account. See `/root/.claude/plans/magical-squishing-wombat.md` (or the
project's `claude/pending-roadmap.md`, roadmap item 10) for the full design
and rationale.

These commands are written for **Windows**, since this app currently only
targets Windows (Phase A). Run them from PowerShell.

## One-time setup

```powershell
# From the backend/ folder: make sure its normal dependencies are
# installed, plus PyInstaller for packaging.
cd backend
pip install -r requirements.txt
pip install pyinstaller

# From the desktop/ folder: install Electron + electron-builder.
cd ..\desktop
npm install
```

## Day-to-day development (fast iteration, no packaging)

Two terminals:

```powershell
# Terminal 1 -- the existing frontend dev server, unchanged
cd frontend
npm run dev
```

```powershell
# Terminal 2 -- the Electron shell, pointed at that dev server
cd desktop
npm run dev
```

This spawns the backend directly via `python backend/desktop_entry.py`
against your repo's own `backend/` folder (no PyInstaller build needed for
this), and loads the running Vite dev server in the Electron window with
devtools open. Edits to `frontend/src/**` hot-reload as usual; edits to
`backend/**` need Electron restarted (Ctrl+C in Terminal 2, `npm run dev`
again) since the Python process isn't watched for changes.

## Building the full installer

```powershell
cd desktop
npm run build:win
```

This runs, in order:
1. `build:backend` -- PyInstaller packages `backend/desktop_entry.py` into
   `desktop/resources/backend/billing-backend.exe` (see
   `backend/packaging/backend.spec`).
2. `build:frontend` -- `vite build` with `VITE_TARGET=desktop`, producing
   `frontend/dist` (same output location as the web build; this is a
   distinct build from what Vercel/Netlify deploy, made with this one extra
   env var).
3. `electron-builder --win` -- bundles both of the above plus the Electron
   shell into a single Windows installer, written to
   `desktop/dist-installer/`.

Run the installer it produces there to try the real, fully-packaged app.

## Testing checklist (see the plan's Verification section for the full version)

- First launch on a clean `%APPDATA%` for this app: should open directly to
  the signup screen (no admin exists yet), not the login screen.
- Create the admin account, log in, create a customer/item/bill.
- Print an invoice -- should go straight to a printer with no OS print
  dialog (silent print).
- Fully close and reopen the app: should go to login (not signup) and all
  previously-created data should still be there.
- Disconnect all networking and repeat login + create-bill + print, to
  confirm there's no accidental dependency on the Render backend anywhere.

## Notes

- No custom app icon yet -- `desktop/electron-builder.yml` has a commented-out
  `win.icon` line ready for when you have a `build/icon.ico` to drop in.
- The backend executable and `frontend/dist` are both gitignored build
  artifacts (see `desktop/.gitignore`) -- run the build steps above to
  regenerate them rather than expecting them to already exist after a fresh
  clone.
