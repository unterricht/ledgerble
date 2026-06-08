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
  BrowserWindow: Object.assign(jest.fn(), { getFocusedWindow: jest.fn() }),
  ipcMain: { on: jest.fn(), handle: jest.fn(), removeAllListeners: jest.fn() },
  dialog: { showOpenDialog: jest.fn(), showSaveDialog: jest.fn() },
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

describe("ipcMain handle 'print-to-pdf'", () => {
  function fakeWindow() {
    return { webContents: { printToPDF: jest.fn().mockResolvedValue(Buffer.from('%PDF-fake')) } };
  }

  it('renders a localised "page X of Y" footer with Chromium page-number spans and writes the chosen file', async () => {
    const { loadLocale } = require('../i18n');
    loadLocale('de');

    const win = fakeWindow();
    electron.BrowserWindow.getFocusedWindow.mockReturnValue(win);
    electron.dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/home/u/report.pdf' });
    const writeSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

    const result = await handleFor('print-to-pdf')({});

    // footer template handed to Chromium must carry the localised text + the
    // pageNumber/totalPages spans Chromium substitutes at print time.
    const pdfOpts = win.webContents.printToPDF.mock.calls[0][0];
    expect(pdfOpts.displayHeaderFooter).toBe(true);
    expect(pdfOpts.printBackground).toBe(true);
    expect(pdfOpts.footerTemplate).toContain('<span class="pageNumber"></span>');
    expect(pdfOpts.footerTemplate).toContain('<span class="totalPages"></span>');
    expect(pdfOpts.footerTemplate).toContain('Seite');
    expect(pdfOpts.footerTemplate).toContain('von');
    // an explicit font size is required or Chromium renders the footer invisibly,
    // and the footer should adopt the design's muted subtext colour + system sans
    expect(pdfOpts.footerTemplate).toMatch(/font-size:\s*[\d.]+(pt|px)/);
    expect(pdfOpts.footerTemplate).toContain('#888D96');
    expect(pdfOpts.footerTemplate).toMatch(/-apple-system/);

    expect(writeSpy).toHaveBeenCalledWith('/home/u/report.pdf', expect.anything());
    expect(result).toEqual({ canceled: false, filePath: '/home/u/report.pdf' });

    writeSpy.mockRestore();
    loadLocale('en');
  });

  it('uses the renderer-supplied file name as the save-dialog default', async () => {
    const win = fakeWindow();
    electron.BrowserWindow.getFocusedWindow.mockReturnValue(win);
    electron.dialog.showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined });
    const writeSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

    await handleFor('print-to-pdf')({}, 'Johannes Budget - Income & Expenses - 04-2023 bis 07-2025.pdf');

    const saveOpts = electron.dialog.showSaveDialog.mock.calls[0][1];
    expect(saveOpts.defaultPath).toBe('Johannes Budget - Income & Expenses - 04-2023 bis 07-2025.pdf');
    writeSpy.mockRestore();
  });

  it('does not write a file when the save dialog is cancelled', async () => {
    const win = fakeWindow();
    electron.BrowserWindow.getFocusedWindow.mockReturnValue(win);
    electron.dialog.showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined });
    const writeSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

    const result = await handleFor('print-to-pdf')({});

    expect(writeSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ canceled: true });
    writeSpy.mockRestore();
  });
});

describe('isAdjustmentRow (csv -B <Adjustment> filtering)', () => {
  const { isAdjustmentRow } = require('../main');

  it('flags synthetic <Adjustment> cost-basis rows so they can be dropped', () => {
    // ledger `csv -B` emits these to balance lot/rounding differences for
    // priced commodities; they have no counterpart in the market `csv` output.
    const row = ['2024/02/01', '', '"Scalable Capital" "Kauf VWRD.L"', '<Adjustment>', '', '-0', '', ''];
    expect(isAdjustmentRow(row)).toBe(true);
  });

  it('keeps real postings', () => {
    const row = ['2024/02/01', '', 'Lohn', 'Assets:Banking:Girokonto', '€', '-100', '', ''];
    expect(isAdjustmentRow(row)).toBe(false);
  });

  it('ignores blank single-field rows', () => {
    expect(isAdjustmentRow([''])).toBe(false);
  });
});
