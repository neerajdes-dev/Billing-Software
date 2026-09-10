"use strict";

/**
 * Electron main process entry point. Responsibilities, in order:
 *  1. Start the local backend (backend-manager.js) and wait for it to be
 *     healthy.
 *  2. Create the BrowserWindow and load the app from that backend --
 *     http://127.0.0.1:<port>/app/ in a packaged build (the backend also
 *     serves the built frontend as static files at that path -- see
 *     backend/desktop_entry.py -- specifically because Chromium refuses to
 *     load ES module <script> tags from a file:// origin at all; loading
 *     from a real http:// origin instead of a plain file:// path is what
 *     avoids that), or the Vite dev server URL in dev mode.
 *  3. Handle the print-invoice / list-printers IPC calls the preload script
 *     exposes to the renderer.
 *  4. Tear the backend process down cleanly on quit.
 */

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const backendManager = require("./backend-manager");

const DEV_FRONTEND_URL = process.env.BILLING_DEV_FRONTEND_URL || "http://localhost:5173";

let backendChild = null;
let mainWindow = null;

async function createWindow() {
  let startResult;
  try {
    startResult = await backendManager.start();
  } catch (err) {
    // A PyInstaller exe that fails to start (bad DATABASE_URL, a missing
    // DLL, the chosen port somehow already taken) otherwise fails
    // completely silently from the end user's point of view -- an error
    // dialog with the captured backend output is much more actionable
    // than a window that never opens or opens blank.
    dialog.showErrorBox(
      "Billing 24×7 could not start",
      `The local billing service didn't start correctly:\n\n${err.message}\n\nPlease restart the app. If this keeps happening, contact support.`
    );
    app.quit();
    return;
  }

  backendChild = startResult.child;
  backendChild.on("exit", () => {
    // If the backend dies unexpectedly after startup (not on our own
    // quit-triggered stop()), the app is no longer usable -- better to
    // quit cleanly than leave a window open that can only ever show
    // "Cannot connect to the server" for every action from here on.
    if (!app.isQuitting) {
      dialog.showErrorBox(
        "Billing 24×7 stopped unexpectedly",
        "The local billing service stopped running. Please restart the app."
      );
      app.quit();
    }
  });

  const isDev = !app.isPackaged;
  const apiBaseUrl = `http://127.0.0.1:${startResult.port}`;

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Read back in preload.js -- see its readApiBaseUrlFromArgv(). This
      // is how the renderer learns the port backend-manager chose for
      // *this* launch, which can never be a build-time constant (see
      // backend-manager.js's pickFreePort()).
      additionalArguments: [`--billing-api-base-url=${apiBaseUrl}`],
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (isDev) {
    await mainWindow.loadURL(DEV_FRONTEND_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadURL(startResult.frontendUrl);
  }
}

ipcMain.handle("print-invoice", async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { ok: false, reason: "No window to print from" };

  return new Promise((resolve) => {
    win.webContents.print(
      {
        silent: options.silent ?? true,
        deviceName: options.printerName || undefined,
        margins: { marginType: "none" },
      },
      (success, failureReason) => {
        resolve({ ok: success, reason: success ? undefined : failureReason });
      }
    );
  });
});

ipcMain.handle("list-printers", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return [];
  return win.webContents.getPrintersAsync();
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  // Standard Electron convention on every platform except macOS, where
  // apps normally stay running (in the dock) with no windows open until
  // the user explicitly quits -- Phase A doesn't add a tray icon or any
  // other way to reopen a closed window on macOS, and Phase A ships
  // Windows-only anyway, so this app quits on window close everywhere.
  app.isQuitting = true;
  backendManager.stop(backendChild);
  app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  backendManager.stop(backendChild);
});
