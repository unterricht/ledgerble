const fs = require('fs');
const path = require('path');

// Print-only, user-facing strings that must be localised across all 12 locales.
const PRINT_KEYS = ['print.base', 'print.printed', 'print.page_x_of_y'];

const dir = path.join(__dirname, '..', 'locales');

for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  test(`${f} has all print keys with non-empty values`, () => {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    for (const k of PRINT_KEYS) {
      expect(typeof j[k]).toBe('string');
      expect(j[k].trim()).not.toBe('');
    }
  });
}
