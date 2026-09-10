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

const result = spawnSync("npm", ["run", "build"], {
  cwd: frontendDir,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, VITE_TARGET: "desktop" },
});

if (result.status !== 0) {
  console.error("Frontend build failed.");
  process.exit(result.status ?? 1);
}

console.log(`Done. Built frontend is at ${path.join(frontendDir, "dist")}`);
