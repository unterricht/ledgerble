const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { execSync } = require('child_process');
const papaparse = require('papaparse')
const moment = require('moment');
const { parseHLedgerVal } = require('./hledger')
const settings = require('settings-store')

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
  // Create the browser window.
  win = new BrowserWindow({
    width: 1500,
    height: 1150,
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
  setupAppMenu(win)

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


function parse(event, command, hledger, file) {

  try {
    let postings;
    if (hledger) {
      postings = parseHLedger(command, file)
    } else {
      postings = parseLedger(command, file)
    }
    event.reply(
      'parsed',
      file,
      postings,
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

function parseLedger(command, file) {

  out = execSync('"' + command + '" -f "' + file + '" csv --no-pager --no-color', { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 })
  res = papaparse.parse(out, {
    delimiter: ',',
    header: false,
    escapeChar: '\\',
  })

  if (res.errors.length > 0) {
    throw res.errors[0].message
  }
  let postings = []
  for (r of res.data) {
    if (r.length != 1) {
      postings.push(
        new Posting(
          new Date(moment(r[0], "YYYY/MM/DD").format()),
          r[3].split(":"),
          parseFloat(r[5]),
          r[4] === '' ? "??" : r[4],
          r[2]
        )
      )
    }
  }
  
  return postings;
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
  const knownKeys = [
    'options.ledger.command',
    'options.hledger',
    'options.expenses.regex',
    'options.income.regex',
    'options.assets.regex',
    'options.liabilities.regex',
    'options.equity.regex',
    'dateUnits',
    'files.list',
  ];
  const result = {};
  for (const key of knownKeys) {
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