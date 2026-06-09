// parseError.js
// Pure logic: turns a thrown parse error into a structured object for the IPC
// reply, distinguishing "the CLI binary was not found" from other failures.

function messageOf(err) {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (err.message) return String(err.message);
  return String(err);
}

function isBinaryNotFound(err) {
  if (err && (err.code === 'ENOENT' || err.code === 127)) return true;
  const m = messageOf(err).toLowerCase();
  return m.includes('enoent')
      || m.includes('command not found')
      || m.includes('not found')
      || m.includes('is not recognized');
}

// tool is 'ledger' | 'hledger' — which binary the failed parse was using.
function classifyParseError(err, tool) {
  const message = messageOf(err);
  if (isBinaryNotFound(err)) return { type: 'binary-not-found', tool, message };
  return { type: 'parse-error', message };
}

module.exports = { classifyParseError };
