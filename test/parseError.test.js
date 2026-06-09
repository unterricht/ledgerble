// test/parseError.test.js
const { classifyParseError } = require('../parseError');

test('ENOENT -> binary-not-found with tool', () => {
  const err = Object.assign(new Error('spawn ledger ENOENT'), { code: 'ENOENT' });
  expect(classifyParseError(err, 'ledger')).toEqual({
    type: 'binary-not-found', tool: 'ledger', message: 'spawn ledger ENOENT',
  });
});

test('exit code 127 -> binary-not-found', () => {
  const err = Object.assign(new Error('Command failed'), { code: 127 });
  expect(classifyParseError(err, 'hledger').type).toBe('binary-not-found');
});

test('windows "is not recognized" -> binary-not-found', () => {
  const err = new Error("'ledger' is not recognized as an internal or external command");
  expect(classifyParseError(err, 'ledger').type).toBe('binary-not-found');
});

test('shell "command not found" -> binary-not-found', () => {
  const err = new Error('/bin/sh: ledger: command not found');
  expect(classifyParseError(err, 'ledger').type).toBe('binary-not-found');
});

test('other errors -> parse-error with message', () => {
  const out = classifyParseError('Too few fields in CSV', 'ledger');
  expect(out).toEqual({ type: 'parse-error', message: 'Too few fields in CSV' });
});
