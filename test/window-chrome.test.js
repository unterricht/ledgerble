const { windowOptionsFor } = require('../windowChrome');

test('macOS uses hiddenInset title bar (keeps native traffic lights + menu)', () => {
  const o = windowOptionsFor('darwin');
  expect(o.titleBarStyle).toBe('hiddenInset');
  expect(o.frame).not.toBe(false);
});
test('Windows is frameless (custom controls + in-window menu)', () => {
  const o = windowOptionsFor('win32');
  expect(o.frame).toBe(false);
});
test('Linux keeps a native frame', () => {
  const o = windowOptionsFor('linux');
  expect(o.frame).not.toBe(false);
});
