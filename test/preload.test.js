/**
 * TDD: RED phase – Tests for preload.js IPC bridge
 */

jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
  ipcRenderer: {
    send: jest.fn(),
    on: jest.fn(),
    invoke: jest.fn(),
  },
}));

const { contextBridge, ipcRenderer } = require('electron');

describe('preload', () => {
  let api;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    // Re-mock after resetModules
    jest.mock('electron', () => ({
      contextBridge: {
        exposeInMainWorld: jest.fn(),
      },
      ipcRenderer: {
        send: jest.fn(),
        on: jest.fn(),
        invoke: jest.fn(),
      },
    }));
    const electron = require('electron');
    require('../preload');
    api = electron.contextBridge.exposeInMainWorld.mock.calls[0][1];
  });

  it('should expose an "api" object via contextBridge', () => {
    const electron = require('electron');
    expect(electron.contextBridge.exposeInMainWorld).toHaveBeenCalledWith('api', expect.any(Object));
  });

  describe('parse', () => {
    it('should send a "parse" IPC message', () => {
      const electron = require('electron');
      api.parse('ledger', false, '/path/to/file.dat');
      expect(electron.ipcRenderer.send).toHaveBeenCalledWith('parse', 'ledger', false, '/path/to/file.dat');
    });
  });

  describe('onParsed', () => {
    it('should register a listener for "parsed" IPC event', () => {
      const electron = require('electron');
      const callback = jest.fn();
      api.onParsed(callback);
      expect(electron.ipcRenderer.on).toHaveBeenCalledWith('parsed', expect.any(Function));
    });

    it('should forward event data to the callback (without the event object)', () => {
      const electron = require('electron');
      const callback = jest.fn();
      api.onParsed(callback);
      // Simulate Electron calling the registered handler
      const registeredHandler = electron.ipcRenderer.on.mock.calls[0][1];
      const fakeEvent = {};
      registeredHandler(fakeEvent, 'file.dat', [{ amount: 10 }], null);
      expect(callback).toHaveBeenCalledWith('file.dat', [{ amount: 10 }], null);
    });
  });

  describe('settings', () => {
    it('should invoke "settings:get" via IPC', async () => {
      const electron = require('electron');
      electron.ipcRenderer.invoke.mockResolvedValue('Monthly');
      const result = await api.settings.get('dateUnits', 'Monthly');
      expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('settings:get', 'dateUnits', 'Monthly');
      expect(result).toBe('Monthly');
    });

    it('should invoke "settings:set" via IPC', async () => {
      const electron = require('electron');
      electron.ipcRenderer.invoke.mockResolvedValue(undefined);
      await api.settings.set('dateUnits', 'Yearly');
      expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('settings:set', 'dateUnits', 'Yearly');
    });

    it('should invoke "settings:getAll" via IPC', async () => {
      const electron = require('electron');
      const allSettings = { 'dateUnits': 'Monthly', 'files.list': [] };
      electron.ipcRenderer.invoke.mockResolvedValue(allSettings);
      const result = await api.settings.getAll();
      expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('settings:getAll');
      expect(result).toEqual(allSettings);
    });
  });

  describe('pathBasename', () => {
    it('should invoke "path:basename" via IPC', async () => {
      const electron = require('electron');
      electron.ipcRenderer.invoke.mockResolvedValue('journal.dat');
      const result = await api.pathBasename('/home/user/journal.dat');
      expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('path:basename', '/home/user/journal.dat');
      expect(result).toBe('journal.dat');
    });
  });

  describe('showOpenDialog', () => {
    it('should invoke "dialog:openFile" with currentPath and return the selected path', async () => {
      const electron = require('electron');
      electron.ipcRenderer.invoke.mockResolvedValue('/home/user/journal.dat');
      const result = await api.showOpenDialog('/usr/local/bin/ledger');
      expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('dialog:openFile', '/usr/local/bin/ledger');
      expect(result).toBe('/home/user/journal.dat');
    });

    it('should return null when the dialog is cancelled', async () => {
      const electron = require('electron');
      electron.ipcRenderer.invoke.mockResolvedValue(null);
      const result = await api.showOpenDialog('/usr/local/bin/ledger');
      expect(result).toBeNull();
    });
  });

  describe('showOpenJournal', () => {
    it('should invoke "dialog:openJournal" and return the selected path', async () => {
      const electron = require('electron');
      electron.ipcRenderer.invoke.mockResolvedValue('/home/user/journal.ledger');
      const result = await api.showOpenJournal();
      expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('dialog:openJournal');
      expect(result).toBe('/home/user/journal.ledger');
    });

    it('should return null when the dialog is cancelled', async () => {
      const electron = require('electron');
      electron.ipcRenderer.invoke.mockResolvedValue(null);
      const result = await api.showOpenJournal();
      expect(result).toBeNull();
    });
  });

  describe('getIncludes', () => {
    it('should invoke "journal:includes" with the file path and return the tree', async () => {
      const electron = require('electron');
      const tree = [{ path: '/home/user/accounts.ledger', includes: [] }];
      electron.ipcRenderer.invoke.mockResolvedValue(tree);
      const result = await api.getIncludes('/home/user/main.ledger');
      expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('journal:includes', '/home/user/main.ledger');
      expect(result).toEqual(tree);
    });
  });

  describe('revealFile', () => {
    it('should send "shell:showItemInFolder" with the file path', () => {
      const electron = require('electron');
      api.revealFile('/home/user/journal.ledger');
      expect(electron.ipcRenderer.send).toHaveBeenCalledWith('shell:showItemInFolder', '/home/user/journal.ledger');
    });
  });

  describe('platform', () => {
    it('should expose process.platform as a string', () => {
      expect(typeof api.platform).toBe('string');
      expect(api.platform.length).toBeGreaterThan(0);
    });
  });

  describe('windowControls', () => {
    it('should send "window:minimize" IPC on minimize()', () => {
      const electron = require('electron');
      api.windowControls.minimize();
      expect(electron.ipcRenderer.send).toHaveBeenCalledWith('window:minimize');
    });

    it('should send "window:maximize" IPC on maximize()', () => {
      const electron = require('electron');
      api.windowControls.maximize();
      expect(electron.ipcRenderer.send).toHaveBeenCalledWith('window:maximize');
    });

    it('should send "window:close" IPC on close()', () => {
      const electron = require('electron');
      api.windowControls.close();
      expect(electron.ipcRenderer.send).toHaveBeenCalledWith('window:close');
    });
  });
});
