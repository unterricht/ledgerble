const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { windowOptionsFor } = require('./windowChrome')
const { execSync } = require('child_process');
const util = require('util');
const execPromise = util.promisify(require('child_process').exec);
const papaparse = require('papaparse')
const moment = require('moment');
const { parseHLedgerVal } = require('./hledger')
const settings = require('settings-store')
const { KNOWN_KEYS } = require('./knownKeys')

class Posting {
  constructor(date, accounts, amount, currency, merchant, type) {
    this.date = date;
    this.accounts = accounts; //array[String]
    this.amount = amount;     //Number
    this.currency = currency; //String
    this.merchant = merchant
    this.type = type
  }
}

// ── Settings-store initialisation (now in main process) ──────
settings.init({
  appName: "Ledgerble",
  publisherName: "sgb",
  reverseDNS: "com.github.sbridges"
})

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

  ipcMain.removeAllListeners('menu:rebuild')
  ipcMain.on('menu:rebuild', () => {
    const newLocaleSetting = settings.value('options.locale', 'auto')
    const newEffectiveLocale = newLocaleSetting === 'auto' ? detectLocale(app.getLocale()) : newLocaleSetting
    loadLocale(newEffectiveLocale)
    setupAppMenu(win)
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

//https://github.com/electron/electron/issues/10451
//not supported on all os's
if (app.setAboutPanelOptions) {
  app.setAboutPanelOptions({
    applicationName: "Ledgerble",
    version: "0.2",
    copyright: "Sean Bridges"
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
    event.reply(
      'parsed',
      file,
      null,
      "error:" + t);
  }
}

async function parseLedgerAsync(command, file) {
  const baseCmd = '"' + command + '" -f "' + file + '"';
  
  const [outCsv, outCsvCost, outPrices] = await Promise.all([
    execPromise(`${baseCmd} csv --no-pager --no-color`, { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 }),
    execPromise(`${baseCmd} csv -B --no-pager --no-color`, { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 }),
    execPromise(`${baseCmd} prices --no-pager --no-color`, { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 }).catch(e => ({ stdout: '' }))
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
          r[2]
        )
      )
    }
  }

  let postingsCost = []
  for (const r of resCost.data) {
    if (r.length != 1) {
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

  out = execSync('"' + command + '" -f "' + file + '" register -O csv', { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 })
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

// ── IPC: custom window controls (Windows frameless chrome) ──
ipcMain.on('window:minimize', () => { if (win) win.minimize(); });
ipcMain.on('window:maximize', () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on('window:close', () => { if (win) win.close(); });