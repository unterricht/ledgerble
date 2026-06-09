// stripVirtual.js
// Pure logic: normalise a ledger/hledger account name by removing the brackets
// that mark virtual postings.
//
// ledger's `csv` output keeps the brackets in the account column verbatim, e.g.
//   [Equity:Budget]   (balanced virtual posting)
//   (Budget:A)        (unbalanced virtual posting)
// If we split such a string on ":" without stripping the brackets, "[Budget:A]"
// and "(Budget:A)" become accounts distinct from each other and from a real
// "Budget:A" — duplicating the account — and the brackets leak into the UI.
//
// Virtual postings should affect balances just like real ones, so we strip the
// surrounding brackets here, turning "[Budget:A]" and "(Budget:A)" both into
// "Budget:A". Only a pair wrapping the WHOLE (trimmed) account is removed;
// brackets inside a segment are left untouched.

function stripVirtual(account) {
  if (typeof account !== 'string') return account;
  const trimmed = account.trim();
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === '[' && last === ']') || (first === '(' && last === ')')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

module.exports = { stripVirtual };
