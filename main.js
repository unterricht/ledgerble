const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { collectIncludes } = require('./includes')
const { windowOptionsFor } = require('./windowChrome')
const { execFile, execFileSync } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);
const papaparse = require('papaparse')
const moment = require('moment');
const { parseHLedgerVal } = require('./hledger')
const { ledgerArgs, hledgerArgs } = require('./ledgerExec')
const settings = require('settings-store')
const { KNOWN_KEYS } = require('./knownKeys')
const os = require('os')
const { resolveBinaries } = require('./binaryResolver')
const { classifyParseError } = require('./parseError')

class Posting {
  constructor(date, accounts, amount, currency, merchant, type, note) {
    this.date = date;
    this.accounts = accounts; //array[String]
    this.amount = amount;     //Number
    this.currency = currency; //String
    this.merchant = merchant
    this.type = type
    this.note = note || ''
  }
}

// ── Settings-store initialisation (now in main process) ──────
settings.init({
  appName: "Ledgerble",
  publisherName: "sgb",
  reverseDNS: "com.github.sbridges"
})

// Resolve ledger/hledger binaries once at startup. GUI apps launched from the
// Dock/Finder/Start menu don't inherit the shell PATH, so the bare "ledger"
// default often fails even when the binary is installed (e.g. Homebrew in
// /opt/homebrew/bin). Probe well-known locations and persist what we find so
// the renderer and the Options UI see the real path.
try {
  resolveBinaries({
    platform: process.platform,
    homedir: os.homedir(),
    canRun: (cmd) => {
      try {
        execFileSync(cmd, ['--version'], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    },
    getSetting: (k, d) => settings.value(k, d),
    setSetting: (k, v) => settings.setValue(k, v),
  });
} catch (e) {
  console.log('binary resolution failed', e);
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow() {
  // Build runtime icon path for win/linux (macOS uses the .icns from the bundle)
  const runtimeIcon = process.platform !== 'darwin'
    ? path.join(__dirname, 'icons', process.platform === 'win32' ? 'gerbil.ico' : 'gerbil.png')
    : undefined;

  // Create the browser window.
  win = new BrowserWindow({
    width: 1500,
    height: 1150,
    ...(runtimeIcon ? { icon: runtimeIcon } : {}),
    ...windowOptionsFor(process.platform),
    webPreferences: {
      // ── Modern Electron security ──────────────────────────
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  })

  // and load the index.html of the app.
  win.loadFile('index.html')

  // Initialize the native application menu
  const { setupAppMenu } = require('./menu')
  const { loadLocale, detectLocale } = require('./i18n')
  const localeSetting = settings.value('options.locale', 'auto')
  const effectiveLocale = localeSetting === 'auto' ? detectLocale(app.getLocale()) : localeSetting
  loadLocale(effectiveLocale)

  setupAppMenu(win)
  refreshAboutPanel()

  ipcMain.removeAllListeners('menu:rebuild')
  ipcMain.on('menu:rebuild', () => {
    const newLocaleSetting = settings.value('options.locale', 'auto')
    const newEffectiveLocale = newLocaleSetting === 'auto' ? detectLocale(app.getLocale()) : newLocaleSetting
    loadLocale(newEffectiveLocale)
    setupAppMenu(win)
    refreshAboutPanel()
  })

  //win.webContents.openDevTools()

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// https://github.com/electron/electron/issues/10451
// Called once on startup and again on locale change so credits are translated.
function refreshAboutPanel() {
  if (!app.setAboutPanelOptions) return;
  const { t } = require('./i18n')
  const iconExt = process.platform === 'win32' ? 'gerbil.ico' : 'gerbil.png'
  const iconPath = path.join(__dirname, 'icons', iconExt)
  app.setAboutPanelOptions({
    applicationName: "Ledgerble",
    applicationVersion: app.getVersion(),
    copyright: t('about.credits'),
    website: "https://github.com/unterricht/ledgerble/",
    iconPath,
  });
}

// ── IPC: Ledger parsing ─────────────────────────────────────

ipcMain.on("parse", function (event, command, hledger, file) {
  parse(event, command, hledger, file);
});


async function parse(event, command, hledger, file) {

  try {
    let result;
    if (hledger) {
      const postings = parseHLedger(command, file);
      result = { postings, postingsCost: postings.map(p => ({ quantity: p.amount, commodity: p.currency })), prices: [] };
    } else {
      result = await parseLedgerAsync(command, file)
    }
    event.reply(
      'parsed',
      file,
      result,
      null);
  } catch (t) {
    console.log('couldnt parse', file, t)
    const tool = hledger ? 'hledger' : 'ledger';
    event.reply('parsed', file, null, classifyParseError(t, tool));
  }
}

// ledger's `csv -B` (cost-basis) mode emits synthetic `<Adjustment>` postings
// to balance lot/rounding differences for priced commodities (e.g. ETFs bought
// in multiple lots). These have no counterpart in the market `csv` output, so
// including them would inflate postingsCost, break positional matching with
// postings, and trigger the map-based fallback warning in valuation.js. The
// account name lives in CSV column index 3.
function isAdjustmentRow(row) {
  return Array.isArray(row) && row[3] === '<Adjustment>';
}

async function parseLedgerAsync(command, file) {
  // execFile (no shell): command + file are passed as literal argv, so shell
  // metacharacters in the journal path or binary path can't inject commands.
  const opts = { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 };

  const [outCsv, outCsvCost, outPrices] = await Promise.all([
    execFilePromise(command, ledgerArgs(file, 'csv'), opts),
    execFilePromise(command, ledgerArgs(file, 'csv-B'), opts),
    execFilePromise(command, ledgerArgs(file, 'prices'), opts).catch(() => ({ stdout: '' }))
  ]);

  const resCsv = papaparse.parse(outCsv.stdout, {
    delimiter: ',',
    header: false,
    escapeChar: '\\',
  })

  if (resCsv.errors.length > 0) {
    throw resCsv.errors[0].message
  }

  const resCost = papaparse.parse(outCsvCost.stdout, {
    delimiter: ',',
    header: false,
    escapeChar: '\\',
  })

  if (resCost.errors.length > 0) {
    throw resCost.errors[0].message
  }

  let postings = []
  for (const r of resCsv.data) {
    if (r.length != 1) {
      // Parse date safely as UTC YYYY-MM-DD string to avoid timezone issues
      const isoDate = moment.utc(r[0], "YYYY/MM/DD").format("YYYY-MM-DD");
      postings.push(
        new Posting(
          isoDate,
          r[3].split(":"),
          parseFloat(r[5]),
          r[4] === '' ? "??" : r[4].replace(/^"|"$/g, ''),
          r[2],
          undefined,
          typeof r[7] === 'string' ? r[7].trim() : ''
        )
      )
    }
  }

  let postingsCost = []
  for (const r of resCost.data) {
    if (r.length != 1 && !isAdjustmentRow(r)) {
      postingsCost.push({
        date: moment.utc(r[0], "YYYY/MM/DD").format("YYYY-MM-DD"),
        account: r[3],
        quantity: parseFloat(r[5]),
        commodity: r[4] === '' ? "??" : r[4].replace(/^"|"$/g, '')
      });
    }
  }

  const prices = [];
  if (outPrices.stdout) {
    const lines = outPrices.stdout.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\d{4}[-/]\d{2}[-/]\d{2})\s+(\S+)\s+(.+)$/);
      if (match) {
         let date = match[1].replace(/\//g, '-');
         let commodity = match[2].replace(/^"|"$/g, '');
         let valStr = match[3].trim();
         let valMatch = valStr.match(/([^0-9.-]*)([0-9.-]+)(.*)/);
         if (valMatch) {
            let price = parseFloat(valMatch[2]);
            let priceCommodity = (valMatch[1] + valMatch[3]).trim() || 'EUR';
            prices.push({ date, commodity, price, priceCommodity });
         }
      }
    }
  }

  return { postings, postingsCost, prices };
}

function parseHLedger(command, file) {

  out = execFileSync(command, hledgerArgs(file), { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 })
  res = papaparse.parse(out, {
    delimiter: ',',
    header: true,
    escapeChar: '"',
    skipEmptyLines: true
  })

  if (res.errors.length > 0) {
    throw res.errors[0].message
  }
  let postings = []
  for (r of res.data) {
    if (r.length != 1) {
      let valAndCurr = r['amount']
      //a hack
      //assume we are formated with the currency at the start
      //or the end, with the value in the middle
      //parse the non numeric bits out first
      //from the end and start, then trim and combine
      //them to get the currency
      let match = valAndCurr.match(/([^0-9.,-]*)([0-9.,-]+)([^0-9.,-]*)/)
      if (!match) {
        console.log(valAndCurr)
      }

      let currVal = parseHLedgerVal(match[2])

      curr = match[1].trim() + match[3].trim()
      if (curr === '') {
        curr = '??'
      }

      postings.push(
        new Posting(
          new Date(moment(r['date'], "YYYY/MM/DD").format()),
          r['account'].split(":"),
          currVal,
          curr,
          r['description']
        )
      )
    }
  }

  return postings
}

// ── IPC: Settings (settings-store now lives in main) ────────

ipcMain.handle('settings:get', (_event, key, defaultVal) => {
  return settings.value(key, defaultVal);
});

ipcMain.handle('settings:set', (_event, key, value) => {
  settings.setValue(key, value);
});

ipcMain.handle('settings:getAll', (_event) => {
  // settings-store doesn't have a "getAll" method, so we read
  // every key we know about and return an object.
  const result = {};
  for (const key of KNOWN_KEYS) {
    const val = settings.value(key, undefined);
    if (val !== undefined) {
      result[key] = val;
    }
  }
  return result;
});

// ── IPC: Path utilities ─────────────────────────────────────

ipcMain.handle('path:basename', (_event, filePath) => {
  return path.basename(filePath);
});

ipcMain.handle('dialog:openFile', async (_event, currentPath) => {
  const defaultPath = currentPath ? path.dirname(currentPath) : undefined;
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    defaultPath,
    properties: ['openFile'],
    filters: [{ name: 'Executables', extensions: ['*'] }],
  });
  return canceled ? null : filePaths[0];
});

// Journal-file picker with plain-text-accounting filters.
ipcMain.handle('dialog:openJournal', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'Ledger / hledger', extensions: ['ledger', 'journal', 'dat', 'hledger', 'j', 'jrnl'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return canceled ? null : filePaths[0];
});

// Reveal a file in the OS file manager (Finder / Explorer).
ipcMain.on('shell:showItemInFolder', (_event, filePath) => {
  if (filePath) shell.showItemInFolder(filePath);
});

// Resolve the nested tree of files `include`d by a journal file.
ipcMain.handle('journal:includes', (_event, filePath) => {
  try {
    return collectIncludes(filePath, (p) => fs.readFileSync(p, 'utf8'));
  } catch {
    return [];
  }
});

// ── IPC: Print to PDF with a localised "page X of Y" footer ──
// window.print() opens the native macOS print panel, which can't add page
// numbers, and Chromium ignores CSS page counters. printToPDF with a
// footerTemplate is the only reliable path: Chromium substitutes the
// pageNumber/totalPages spans, and we localise the text around them.
ipcMain.handle('print-to-pdf', async (_event, defaultName) => {
  const targetWin = (BrowserWindow.getFocusedWindow && BrowserWindow.getFocusedWindow()) || win;
  if (!targetWin) return { canceled: true };

  try {
    const { t } = require('./i18n');
    const footer = t('print.page_x_of_y')
      .replace('{x}', '<span class="pageNumber"></span>')
      .replace('{y}', '<span class="totalPages"></span>');
    // An explicit font size is mandatory: Chromium defaults the footer font to
    // ~0, rendering it invisible. Match the printed letterhead's typography —
    // the "Quiet Ledger" system-sans stack, the muted #888D96 subtext colour
    // and the 8.5pt table-density size — so the footer sits with the document.
    // The 13mm padding/margins match index.html's @page { margin:13mm }.
    const footerStyle = [
      'width:100%',
      'box-sizing:border-box',
      'padding:0 13mm',
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif",
      'font-size:8.5pt',
      'letter-spacing:0.01em',
      'color:#888D96',
      'text-align:center',
    ].join(';');
    const footerTemplate = `<div style="${footerStyle}">${footer}</div>`;

    const pdf = await targetWin.webContents.printToPDF({
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate,
      margins: { marginType: 'custom', top: 0.51, bottom: 0.51, left: 0.51, right: 0.51 },
    });

    const { canceled, filePath } = await dialog.showSaveDialog(targetWin, {
      defaultPath: defaultName || 'ledgerble.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return { canceled: true };

    await fs.promises.writeFile(filePath, pdf);
    return { canceled: false, filePath };
  } catch (err) {
    console.error('print-to-pdf failed', err);
    throw err;
  }
});

// ── IPC: custom window controls (Windows frameless chrome) ──
ipcMain.on('window:minimize', () => { if (win) win.minimize(); });
ipcMain.on('window:maximize', () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on('window:close', () => { if (win) win.close(); });

module.exports = { isAdjustmentRow };