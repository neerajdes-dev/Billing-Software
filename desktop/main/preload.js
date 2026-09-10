"use strict";

/**
 * Runs in a privileged context before the renderer's own page scripts, and
 * exposes exactly the desktop-only capabilities the frontend needs via
 * contextBridge -- nothing else from Node/Electron's main-process APIs is
 * reachable from the page itself (contextIsolation stays on; see main.js).
 *
 * frontend/src/services/api.js reads window.electronAPI.apiBaseUrl (falls
 * back to today's Vite-build-time VITE_API_URL when it's undefined, i.e.
 * on the web build -- see that file's comment). frontend/src/utils/
 * printInvoice.js reads window.electronAPI.print for silent printer
 * output instead of window.print()'s OS dialog.
 */

const { contextBridge, ipcRenderer } = require("electron");

// main.js passes the backend's actual local URL in via
// webPreferences.additionalArguments at BrowserWindow creation time (see
// main.js) specifically because the backend's port is chosen fresh on
// every launch (backend-manager.js's pickFreePort()) to avoid colliding
// with anything else already running on the shop's PC -- it can never be
// a Vite build-time constant the way VITE_API_URL is for the web deploy.
function readApiBaseUrlFromArgv() {
  const marker = "--billing-api-base-url=";
  const arg = process.argv.find((a) => a.startsWith(marker));
  return arg ? arg.slice(marker.length) : "";
}

contextBridge.exposeInMainWorld("electronAPI", {
  apiBaseUrl: readApiBaseUrlFromArgv(),

  /**
   * options: { silent?: boolean, printerName?: string }
   * Resolves to { ok: boolean, reason?: string }. See main.js's
   * "print-invoice" handler -- this renders the current page (already
   * CSS-sized for A4/thermal by printInvoice.js before this is called)
   * directly to a printer via Electron's webContents.print(), with no OS
   * print dialog when silent is true.
   */
  print: (options) => ipcRenderer.invoke("print-invoice", options),

  /**
   * Resolves to an array of { name, displayName, isDefault, ... } (see
   * Electron's webContents.getPrintersAsync() docs for the full shape).
   * Not used by anything in Phase A itself -- exposed now so a later
   * printer-selection settings screen (roadmap item 14) has something to
   * call into immediately without another round of preload/IPC plumbing.
   */
  listPrinters: () => ipcRenderer.invoke("list-printers"),
});
