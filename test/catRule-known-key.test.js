/**
 * Asserts that 'options.overview.catRule' is in the KNOWN_KEYS list so that
 * the setting survives a restart (main process reads only known keys in getAll).
 */
const { KNOWN_KEYS } = require('../knownKeys');

test('catRule is a known persisted key', () => {
  expect(KNOWN_KEYS).toContain('options.overview.catRule');
});
