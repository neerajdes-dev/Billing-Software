"use strict";

/**
 * Owns the lifecycle of the local Python backend (billing-backend.exe in a
 * packaged build; `python backend/desktop_entry.py` against the repo's own
 * backend/ in dev mode -- see isPackaged branch below). Electron's main
 * process (main.js) calls start() once at app startup and stop() on quit;
 * everything else here is private to making that one round-trip reliable:
 * picking a free port, building the child's environment from scratch (there
 * is no .env file shipped with this app), persisting the JWT SECRET_KEY
 * across launches, and polling the existing /health endpoint until the
 * backend is actually ready to serve requests before the renderer ever
 * tries to talk to it.
 */

const { app } = require("electron");
const { spawn } = require("node:child_process");
const net = require("node:net");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const CONFIG_FILE_NAME = "desktop-config.json";
const DB_FILE_NAME = "billing.db";
const HEALTH_CHECK_TIMEOUT_MS = 15000;
const HEALTH_CHECK_INTERVAL_MS = 200;

/**
 * Ask the OS for a free TCP port by briefly binding to port 0 (the
 * standard "ask the kernel for any free port" trick), then release it
 * immediately so the backend process can bind to the same number. There is
 * a small unavoidable race between releasing the probe socket and the
 * backend binding it, but it's the same approach every "pick a free local
 * port" implementation uses and is more than reliable enough for a
 * single-user desktop app talking to itself.
 */
function pickFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/**
 * SECRET_KEY has to survive across app launches -- generating a fresh one
 * every time would silently invalidate every previously-issued login
 * session on the very next launch, forcing the shop owner to log back in
 * every time they open the app. Persisted alongside (not inside) the
 * SQLite DB file, in the same per-user app-data directory, so a full
 * uninstall/reinstall that clears that directory naturally resets both
 * together rather than leaving an orphaned key or DB.
 */
function loadOrCreateConfig(userDataDir) {
  const configPath = path.join(userDataDir, CONFIG_FILE_NAME);
  try {
    const existing = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (existing && typeof existing.secretKey === "string" && existing.secretKey) {
      return existing;
    }
  } catch (err) {
    // File doesn't exist yet, or is unreadable/corrupt -- either way, fall
    // through and (re)create it below rather than crash app startup over a
    // config file.
  }

  const config = { secretKey: crypto.randomBytes(32).toString("hex") };
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  return config;
}

/**
 * Builds a sqlite:/// URL SQLAlchemy will accept for an absolute path on
 * any OS, including Windows -- SQLAlchemy's SQLite URL form wants forward
 * slashes and four slashes total before an absolute path
 * (sqlite:////C:/Users/.../billing.db), not the two used for a relative
 * path (sqlite:///./billing.db).
 */
function sqliteUrlForPath(absolutePath) {
  const normalized = absolutePath.split(path.sep).join("/");
  return `sqlite:///${normalized}`;
}

/**
 * Resolves everything backend-manager needs to know about *where things
 * are*, branching once on app.isPackaged so the rest of this module never
 * has to think about dev vs. packaged again:
 *  - packaged: the PyInstaller exe at resourcesPath/backend/billing-backend.exe,
 *    and the built frontend at resourcesPath/frontend-dist (see
 *    electron-builder.yml's extraResources).
 *  - dev: `python backend/desktop_entry.py` run directly against the repo's
 *    own backend/ folder (found relative to this file, two levels up),
 *    using whatever Python is already on the developer's PATH -- no
 *    PyInstaller build needed for day-to-day Electron development. The
 *    frontend isn't served this way in dev mode at all (see main.js: dev
 *    mode loads the Vite dev server URL directly instead), so
 *    FRONTEND_DIST_DIR is left unset.
 */
function resolvePaths() {
  if (app.isPackaged) {
    const backendExe = path.join(
      process.resourcesPath,
      "backend",
      process.platform === "win32" ? "billing-backend.exe" : "billing-backend"
    );
    const frontendDist = path.join(process.resourcesPath, "frontend-dist");
    return {
      mode: "packaged",
      command: backendExe,
      args: [],
      cwd: path.dirname(backendExe),
      frontendDistDir: frontendDist,
    };
  }

  const repoBackendDir = path.join(__dirname, "..", "..", "backend");
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  return {
    mode: "dev",
    command: pythonCmd,
    args: [path.join(repoBackendDir, "desktop_entry.py")],
    cwd: repoBackendDir,
    frontendDistDir: null,
  };
}

function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(
        { host: "127.0.0.1", port, path: "/health", timeout: 1000 },
        (res) => {
          res.resume();
          if (res.statusCode === 200) {
            resolve();
          } else {
            retryOrFail(`/health returned status ${res.statusCode}`);
          }
        }
      );
      req.on("error", (err) => retryOrFail(err.message));
      req.on("timeout", () => {
        req.destroy();
        retryOrFail("request timed out");
      });
    };

    const retryOrFail = (reason) => {
      if (Date.now() > deadline) {
        reject(new Error(`Backend did not become healthy in time (last error: ${reason})`));
        return;
      }
      setTimeout(attempt, HEALTH_CHECK_INTERVAL_MS);
    };

    attempt();
  });
}

/**
 * Starts the backend and waits for it to answer /health before resolving.
 * Returns { child, port, logs } -- `logs` is a small ring of the child's
 * recent stdout/stderr, kept specifically so main.js can show a real error
 * message (rather than a silently blank window) if the backend crashes or
 * never becomes healthy: a PyInstaller exe that fails to start (a bad
 * DATABASE_URL, a missing DLL, a port already in use) otherwise fails
 * completely silently from the end user's point of view.
 */
async function start() {
  const userDataDir = app.getPath("userData");
  const { secretKey } = loadOrCreateConfig(userDataDir);
  const dbPath = path.join(userDataDir, DB_FILE_NAME);
  const port = await pickFreePort();
  const paths = resolvePaths();

  const env = {
    ...process.env,
    BILLING_LOCAL_PORT: String(port),
    DATABASE_URL: sqliteUrlForPath(dbPath),
    SECRET_KEY: secretKey,
    JWT_ALGORITHM: "HS256",
    ACCESS_TOKEN_EXPIRE_MINUTES: "60",
    // Same-origin once the frontend is served from this same backend (see
    // desktop_entry.py's _mount_frontend_if_configured) -- set defensively
    // in case devtools or a future webview ever makes a cross-origin
    // request, but not load-bearing for normal operation.
    CORS_ORIGINS: `http://127.0.0.1:${port}`,
  };
  if (paths.frontendDistDir) {
    env.FRONTEND_DIST_DIR = paths.frontendDistDir;
  }

  const logs = [];
  const pushLog = (chunk) => {
    logs.push(chunk.toString());
    if (logs.length > 200) logs.shift();
  };

  const child = spawn(paths.command, paths.args, {
    cwd: paths.cwd,
    env,
    windowsHide: true,
  });
  child.stdout.on("data", pushLog);
  child.stderr.on("data", pushLog);

  let exitedEarly = null;
  child.on("exit", (code, signal) => {
    exitedEarly = { code, signal };
  });

  try {
    await waitForHealth(port, HEALTH_CHECK_TIMEOUT_MS);
  } catch (err) {
    const detail = exitedEarly
      ? `backend process exited (code ${exitedEarly.code}, signal ${exitedEarly.signal})`
      : err.message;
    const fullLog = logs.join("");
    child.kill();
    throw new Error(`${detail}\n\n${fullLog}`);
  }

  return { child, port, frontendUrl: `http://127.0.0.1:${port}/app/` };
}

/**
 * Graceful-ish teardown: SIGTERM (Windows: TerminateProcess via Node's
 * child.kill()) is acceptable here specifically because SQLite commits are
 * per-request/per-transaction, not buffered in the application layer --
 * there's no in-memory write queue that could be lost by not waiting for a
 * clean shutdown sequence. This still matters: without it, an orphaned
 * billing-backend.exe would keep the SQLite file locked and the port bound
 * on the next launch.
 */
function stop(child) {
  if (!child || child.killed) return;
  try {
    child.kill();
  } catch (err) {
    // Process may have already exited on its own; nothing more to do.
  }
}

module.exports = { start, stop, pickFreePort, sqliteUrlForPath };
