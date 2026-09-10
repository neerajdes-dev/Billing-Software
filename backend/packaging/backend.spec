# PyInstaller spec for the desktop app's local backend.
#
# Produces a single billing-backend.exe (Windows) / billing-backend binary
# (other platforms, for local dev/testing only -- Phase A only ships
# Windows) that runs backend/desktop_entry.py, i.e. the same FastAPI app
# (main:app) the web deploy runs via `uvicorn main:app`, with zero business
# logic reimplemented or duplicated.
#
# Build (run from the backend/ directory, with the project's own Python
# environment active -- the one requirements.txt is installed into):
#
#   pyinstaller packaging/backend.spec --distpath ../desktop/resources/backend --workpath ../build/pyinstaller
#
# (desktop/scripts/build-backend.ps1 runs exactly this.)
#
# Why PyInstaller: it has the most mature handling, among the common
# Python-to-exe packagers, of packages with C extensions and
# import-machinery-based dynamic loading -- exactly what this app's
# dependency set needs (psycopg2-binary's C extension, cryptography's
# compiled backend, and SQLAlchemy's dialect plugins, which are loaded by
# string/entry-point lookup rather than a plain top-level `import`, so
# PyInstaller's static import-graph analysis cannot find them on its own --
# hence the explicit hiddenimports below).
#
# psycopg2-binary is kept in the bundle even though the desktop app only
# ever uses the sqlite dialect at runtime: backend/database.py and main.py
# are the same files used by the web deploy, and keeping one build of the
# backend that can talk to either database (rather than a forked
# desktop-only requirements set) means there is only ever one backend
# codebase to maintain. The extra size is a few MB, not worth the
# maintenance split.

import sys
from pathlib import Path

block_cipher = None

# packaging/backend.spec's own directory is backend/packaging/; the actual
# app code (main.py, models.py, desktop_entry.py, ...) lives one level up.
backend_dir = Path(SPECPATH).parent

a = Analysis(
    [str(backend_dir / "desktop_entry.py")],
    pathex=[str(backend_dir)],
    binaries=[],
    datas=[],
    hiddenimports=[
        # SQLAlchemy resolves its DB dialect implementation by string name
        # (from the DATABASE_URL scheme, e.g. "sqlite" or "postgresql"),
        # not via a static top-level import PyInstaller's analyzer can
        # trace -- both dialects are included so one build can run against
        # either database (see note above).
        "sqlalchemy.dialects.sqlite",
        "sqlalchemy.dialects.sqlite.pysqlite",
        "sqlalchemy.dialects.postgresql",
        "sqlalchemy.dialects.postgresql.psycopg2",
        "psycopg2",
        # cryptography's backend selection is similarly dynamic.
        "cryptography.hazmat.backends.openssl",
        # uvicorn's optional/protocol implementations are also selected at
        # runtime rather than imported directly by name in this app's code.
        "uvicorn.logging",
        "uvicorn.loops.auto",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan.on",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="billing-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # keep a console window for Phase A so startup errors
                   # (e.g. a bad DATABASE_URL, a port already in use) are
                   # visible rather than silently swallowed; Electron's own
                   # health-check + error dialog (backend-manager.js) is the
                   # primary error-surfacing path for end users, this is a
                   # secondary aid for anyone debugging the exe directly.
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    onefile=True,
)
