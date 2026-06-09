// test/binaryResolver.test.js
const { candidatesFor, findBinary } = require('../binaryResolver');

describe('candidatesFor', () => {
  test('macOS ledger list, in order', () => {
    expect(candidatesFor('darwin', 'ledger', '/Users/x')).toEqual([
      '/opt/homebrew/bin/ledger', '/usr/local/bin/ledger',
      '/opt/local/bin/ledger', '/usr/bin/ledger',
    ]);
  });
  test('macOS hledger expands ~ to homedir', () => {
    expect(candidatesFor('darwin', 'hledger', '/Users/x')).toEqual([
      '/opt/homebrew/bin/hledger', '/usr/local/bin/hledger',
      '/Users/x/.local/bin/hledger', '/Users/x/.ghcup/bin/hledger',
    ]);
  });
  test('linux hledger prefers ~/.local/bin', () => {
    expect(candidatesFor('linux', 'hledger', '/home/x')[0]).toBe('/home/x/.local/bin/hledger');
  });
  test('windows ledger uses .exe and backslashes', () => {
    expect(candidatesFor('win32', 'ledger', 'C:\\Users\\x')).toEqual([
      'C:\\msys64\\usr\\bin\\ledger.exe',
      'C:\\Users\\x\\scoop\\shims\\ledger.exe',
      'C:\\ProgramData\\chocolatey\\bin\\ledger.exe',
    ]);
  });
});

describe('findBinary', () => {
  const deps = (runnable) => ({
    platform: 'darwin', homedir: '/Users/x',
    canRun: (cmd) => runnable.includes(cmd),
  });

  test('configured command works -> unchanged', () => {
    expect(findBinary('ledger', 'ledger', deps(['ledger'])))
      .toEqual({ command: 'ledger', changed: false });
  });
  test('configured missing, first candidate wins', () => {
    expect(findBinary('ledger', 'ledger', deps(['/usr/local/bin/ledger', '/opt/homebrew/bin/ledger'])))
      .toEqual({ command: '/opt/homebrew/bin/ledger', changed: true });
  });
  test('candidate order respected', () => {
    expect(findBinary('ledger', 'ledger', deps(['/usr/bin/ledger'])))
      .toEqual({ command: '/usr/bin/ledger', changed: true });
  });
  test('nothing runnable -> null', () => {
    expect(findBinary('ledger', 'ledger', deps([])))
      .toEqual({ command: null, changed: false });
  });
});
