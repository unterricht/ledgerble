// ledgerExec.js
// Pure logic: builds the argv arrays for the ledger/hledger CLI invocations.
//
// These are arrays, not shell strings, so main.js can drive the CLI with
// execFile/execFileSync (no shell). The journal path and binary are then passed
// to the process literally — a journal named `x"; rm -rf ~` is just a (missing)
// filename, never a shell command. This is the boundary that closes the
// command-injection hole the old `exec('"'+cmd+'" -f "'+file+'"')` path had.

// mode: 'csv' (market amounts) | 'csv-B' (cost basis) | 'prices'
function ledgerArgs(file, mode) {
  const base = ['-f', file];
  const tail = ['--no-pager', '--no-color'];
  switch (mode) {
    case 'csv':    return [...base, 'csv', ...tail];
    case 'csv-B':  return [...base, 'csv', '-B', ...tail];
    case 'prices': return [...base, 'prices', ...tail];
    default:
      throw new Error(`ledgerArgs: unknown mode "${mode}"`);
  }
}

function hledgerArgs(file) {
  return ['-f', file, 'register', '-O', 'csv'];
}

module.exports = { ledgerArgs, hledgerArgs };
