// binaryResolver.js
// Pure logic: locates the ledger/hledger binary across platforms.
// No electron/fs imports — platform, homedir and canRun are injected so the
// module is unit-testable and the browser bundle never needs Node built-ins.

function join(base, parts, sep) {
  return base.replace(/[\\/]+$/, '') + sep + parts.join(sep);
}

// Returns the ordered list of absolute candidate paths to probe for `binary`
// ('ledger' | 'hledger') on `platform`, with `~` expanded to `homedir`.
function candidatesFor(platform, binary, homedir) {
  if (platform === 'win32') {
    const exe = binary + '.exe';
    const home = (parts) => join(homedir, parts, '\\');
    if (binary === 'hledger') {
      return [
        home(['AppData', 'Roaming', 'local', 'bin', exe]),
        home(['scoop', 'shims', exe]),
        home(['AppData', 'Local', 'Programs', 'hledger', exe]),
      ];
    }
    return [
      'C:\\msys64\\usr\\bin\\' + exe,
      home(['scoop', 'shims', exe]),
      'C:\\ProgramData\\chocolatey\\bin\\' + exe,
    ];
  }
  const home = (parts) => join(homedir, parts, '/');
  if (platform === 'darwin') {
    if (binary === 'hledger') {
      return [
        '/opt/homebrew/bin/hledger', '/usr/local/bin/hledger',
        home(['.local', 'bin', 'hledger']), home(['.ghcup', 'bin', 'hledger']),
      ];
    }
    return [
      '/opt/homebrew/bin/ledger', '/usr/local/bin/ledger',
      '/opt/local/bin/ledger', '/usr/bin/ledger',
    ];
  }
  // linux (and any other POSIX)
  if (binary === 'hledger') {
    return [
      home(['.local', 'bin', 'hledger']), home(['.ghcup', 'bin', 'hledger']),
      '/usr/bin/hledger', '/usr/local/bin/hledger', '/snap/bin/hledger',
    ];
  }
  return ['/usr/bin/ledger', '/usr/local/bin/ledger', '/snap/bin/ledger'];
}

// Resolves the binary: keep the configured command if it runs, otherwise probe
// the platform candidate list. Returns { command, changed }.
function findBinary(binary, configuredCmd, { platform, homedir, canRun }) {
  if (configuredCmd && canRun(configuredCmd)) {
    return { command: configuredCmd, changed: false };
  }
  for (const cand of candidatesFor(platform, binary, homedir)) {
    if (canRun(cand)) return { command: cand, changed: true };
  }
  return { command: null, changed: false };
}

module.exports = { candidatesFor, findBinary };
