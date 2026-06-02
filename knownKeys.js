/**
 * knownKeys.js — list of all persisted setting keys understood by the main process.
 *
 * Required by both main.js (ipcMain settings:getAll handler) and tests,
 * so it lives in its own module to avoid pulling in electron in the test env.
 */
const KNOWN_KEYS = [
  'options.ledger.command',
  'options.hledger',
  'options.expenses.regex',
  'options.income.regex',
  'options.assets.regex',
  'options.liabilities.regex',
  'options.equity.regex',
  'options.locale',
  'options.overview.catRule',
  'dateUnits',
  'files.list',
];

module.exports = { KNOWN_KEYS };
