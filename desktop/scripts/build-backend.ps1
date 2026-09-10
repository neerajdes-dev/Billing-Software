# Builds the packaged desktop backend (billing-backend.exe) via PyInstaller,
# using backend/packaging/backend.spec. Run this from the desktop/ directory
# (e.g. `npm run build:backend`, which invokes this script) -- it resolves
# every path relative to its own location, so it also works if invoked
# directly as `powershell -File scripts/build-backend.ps1` from desktop/.
#
# Prerequisite: the backend's own Python environment must already have its
# dependencies installed (`pip install -r requirements.txt` from backend/),
# plus pyinstaller itself (`pip install pyinstaller`) -- both into whichever
# Python this script's `python` resolves to on PATH.

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktopDir = Split-Path -Parent $scriptDir
$repoRoot = Split-Path -Parent $desktopDir
$backendDir = Join-Path $repoRoot "backend"
$specPath = Join-Path $backendDir "packaging\backend.spec"
$distPath = Join-Path $desktopDir "resources\backend"
$workPath = Join-Path $repoRoot "build\pyinstaller"

Write-Host "Building billing-backend.exe from $specPath"
Write-Host "Output: $distPath"

Push-Location $backendDir
try {
    pyinstaller $specPath --distpath $distPath --workpath $workPath --noconfirm
} finally {
    Pop-Location
}

Write-Host "Done. billing-backend.exe should now be at $distPath\billing-backend.exe"
