const fs = require('fs');
const path = require('path');

const KEYS = [
  'settings.hledger_command',
  'settings.hledger_command.help',
  'error.binary_not_found.title',
  'error.binary_not_found.body',
  'error.binary_not_found.action',
  'error.parse_error.body',
];

const dir = path.join(__dirname, '..', 'locales');

for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  test(`${f} has all binary-detection keys`, () => {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    for (const k of KEYS) {
      expect(j[k]).toBeDefined();
    }
  });
}
