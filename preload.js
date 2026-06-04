/**
 * Preload script for Electron contextIsolation.
 *
 * Exposes a safe, typed API to the renderer process via
 * contextBridge.exposeInMainWorld('api', { ... }).
 *
 * The renderer must NEVER have direct access to Node.js or
 * Electron internals – all communication goes through this bridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {

  // ── Ledger Parsing ────────────────────────────────────────────
  /**
   * Request the main process to parse a ledger/hledger file.
   * Results arrive asynchronously via onParsed().
   */
  parse: (command, hledger, file) => {
    ipcRenderer.send('parse', command, hledger, file);
  },

  /**
   * Register a callback for parsed results.
   * callback(file, postings, error)
   */
  onParsed: (callback) => {
    ipcRenderer.on('parsed', (_event, file, postings, error) => {
      callback(file, postings, error);
    });
  },

  // ── Settings (via main process) ───────────────────────────────
  settings: {
    get: (key, defaultVal) => {
      return ipcRenderer.invoke('settings:get', key, defaultVal);
    },
    set: (key, value) => {
      return ipcRenderer.invoke('settings:set', key, value);
    },
    getAll: () => {
      return ipcRenderer.invoke('settings:getAll');
    },
  },

  // ── File dialog ───────────────────────────────────────────────
  showOpenDialog: (currentPath) => {
    return ipcRenderer.invoke('dialog:openFile', currentPath);
  },

  // ── Menu ──────────────────────────────────────────────────────
  menu: {
    rebuild: () => {
      ipcRenderer.send('menu:rebuild');
    }
  },

  // ── Utilities ─────────────────────────────────────────────────
  pathBasename: (filePath) => {
    return ipcRenderer.invoke('path:basename', filePath);
  },
  
  webUtils: {
    getPathForFile: (file) => require('electron').webUtils.getPathForFile(file)
  },

  // ── Platform info ─────────────────────────────────────────
  platform: process.platform,

  // ── Window Controls (Windows frameless chrome) ────────────
  windowControls: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
});
