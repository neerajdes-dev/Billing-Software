#!/usr/bin/env node
// Builds the frontend for the desktop app: runs the existing `npm run
// build` (vite build) inside frontend/, but with VITE_TARGET=desktop set so
// the desktop-only branches in frontend/src/AppRouter.js and
// vite.config.js take effect (HashRouter, relative asset base). This is
// the *only* thing that differs from the plain web build -- everything
// else (the build command, the output directory) is identical to what
// Vercel/Netlify already run.
//
// Output lands at frontend/dist, same as the web build -- electron-builder
// (see ../electron-builder.yml's extraResources) reads directly from
// there, so this script does not copy anything; it just re-runs the build
// with the right env var set.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.join(__dirname, "..", "..", "frontend");

console.log(`Building frontend (VITE_TARGET=desktop) in ${frontendDir}`);

// On Windows, "npm" itself is a .cmd shim, which the OS can only launch
// through a command interpreter (CreateProcess can't exec a .cmd file
// directly) -- so shell:true is required there, not optional. (A prior
// version of this script tried to sidestep that by naming "npm.cmd"
// explicitly with shell left off; that failed outright on Windows with no
// build output at all, because spawnSync still couldn't launch a .cmd file
// without a shell.) Node's DEP0190 warning is specifically about combining
// shell:true with an *args array* (the shell re-splits/re-quotes it,
// which is the actual risk the warning is about) -- so the fix is to keep
// shell:true but fold the (hardcoded, not user input) arguments into a
// single command string instead of passing them as an array.
const command = process.platform === "win32" ? "npm.cmd run build" : "npm run build";

const result = spawnSync(command, {
  cwd: frontendDir,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, VITE_TARGET: "desktop" },
});

if (result.error) {
  console.error("Frontend build failed to start:", result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error("Frontend build failed.");
  process.exit(result.status ?? 1);
}

console.log(`Done. Built frontend is at ${path.join(frontendDir, "dist")}`);
