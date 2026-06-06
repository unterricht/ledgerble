/**
 * Tests for the main-process IPC handlers added for journal file management.
 *
 * main.js registers its handlers at import time via ipcMain.handle/on. We mock
 * electron + settings-store so requiring main.js is side-effect-free (the window
 * is only created on the never-fired 'ready' event), then pull the registered
 * handlers out of the mocks and invoke them directly.
 */
const fs = require('fs');
const path = require('path');

jest.mock('electron', () => ({
  app: {
    on: jest.fn(),
    getLocale: () => 'en',
    getVersion: () => '0.0.0-test',
    setAboutPanelOptions: jest.fn(),
  },
  BrowserWindow: jest.fn(),
  ipcMain: { on: jest.fn(), handle: jest.fn(), removeAllListeners: jest.fn() },
  dialog: { showOpenDialog: jest.fn() },
  shell: { showItemInFolder: jest.fn() },
}));

jest.mock('settings-store', () => ({
  init: jest.fn(),
  value: jest.fn(() => undefined),
  setValue: jest.fn(),
}));

let electron = require('electron');

function loadMain() {
  jest.resetModules();
  require('../main');
  // resetModules gives main.js a fresh electron mock instance; re-acquire it so
  // the captured mock.calls belong to the same object main.js registered against.
  electron = require('electron');
}
const handleFor = (channel) => {
  const call = electron.ipcMain.handle.mock.calls.find((c) => c[0] === channel);
  return call && call[1];
};
const listenerFor = (channel) => {
  const call = electron.ipcMain.on.mock.calls.find((c) => c[0] === channel);
  return call && call[1];
};

beforeEach(() => {
  jest.clearAllMocks();
  loadMain();
});

describe("ipcMain handle 'dialog:openJournal'", () => {
  it('returns the chosen path and filters for ledger/hledger journal extensions', async () => {
    electron.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/home/u/main.ledger'] });
    const handler = handleFor('dialog:openJournal');
    const result = await handler({});
    expect(result).toBe('/home/u/main.ledger');

    const opts = electron.dialog.showOpenDialog.mock.calls[0][1];
    const exts = opts.filters.flatMap((f) => f.extensions);
    expect(exts).toEqual(expect.arrayContaining(['ledger', 'journal', 'dat', 'hledger']));
  });

  it('returns null when the dialog is cancelled', async () => {
    electron.dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    const handler = handleFor('dialog:openJournal');
    expect(await handler({})).toBeNull();
  });
});

describe("ipcMain on 'shell:showItemInFolder'", () => {
  it('reveals the given path', () => {
    listenerFor('shell:showItemInFolder')({}, '/home/u/main.ledger');
    expect(electron.shell.showItemInFolder).toHaveBeenCalledWith('/home/u/main.ledger');
  });

  it('ignores a falsy path', () => {
    listenerFor('shell:showItemInFolder')({}, '');
    expect(electron.shell.showItemInFolder).not.toHaveBeenCalled();
  });
});

describe("ipcMain handle 'journal:includes'", () => {
  it('resolves the include tree by reading files from disk', () => {
    const map = {
      [path.resolve('/j/main.ledger')]: 'include a.ledger',
      [path.resolve('/j/a.ledger')]: '',
    };
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (map[p] === undefined) throw new Error('ENOENT');
      return map[p];
    });

    const result = handleFor('journal:includes')({}, '/j/main.ledger');
    expect(result).toEqual([{ path: path.resolve('/j/a.ledger'), includes: [] }]);
    spy.mockRestore();
  });

  it('returns an empty list when the file cannot be read', () => {
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation(() => { throw new Error('ENOENT'); });
    expect(handleFor('journal:includes')({}, '/nope.ledger')).toEqual([]);
    spy.mockRestore();
  });
});
