/**
 * Build a smart default file name for "Print to PDF…".
 *
 * Shape:  "{ledger file} - {tab name} - {period range}.pdf"
 *   e.g.  "Johannes Budget - Einnahmen & Ausgaben - 04-2023 bis 07-2025.pdf"
 *
 * Renderer-safe: no Node built-ins (no `path`), so it bundles for the browser.
 * The localised range connector (e.g. "bis" / "to") is passed in by the caller
 * so this stays a pure, framework-free helper.
 */

// Strip any directory (POSIX or Windows) and a single trailing extension.
function baseNameNoExt(filePath) {
  if (!filePath) return '';
  const base = String(filePath).split('/').pop().split('\\').pop();
  return base.replace(/\.[^.]+$/, '');
}

// Reduce a compute-layer interval label to a compact numeric form, ordered
// most-specific-first so a sorted file listing groups by month/quarter/week.
function intervalToNumeric(label, period) {
  if (!label) return '';
  const parts = String(label).split('-'); // "2023-04", "2023-Q1", "2023-W05", "2023-04-15", "2023"
  switch (period) {
    case 'Yearly':
      return parts[0];
    case 'Daily':
      return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : label;
    case 'Monthly':
    case 'Quarterly':
    case 'Weekly':
    default:
      return parts.length >= 2 ? `${parts[1]}-${parts[0]}` : label;
  }
}

function formatRange(intervals, period, connector) {
  if (!Array.isArray(intervals) || intervals.length === 0) return '';
  const first = intervalToNumeric(intervals[0], period);
  const last = intervalToNumeric(intervals[intervals.length - 1], period);
  if (!first) return '';
  if (first === last || !last) return first;
  return `${first} ${connector} ${last}`;
}

// Path separators and characters Windows/macOS forbid in file names. Spaces,
// hyphens and "&" are intentionally kept — they're part of the intended shape.
const ILLEGAL = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|']);

function sanitize(name) {
  return Array.from(name)
    .filter((ch) => !ILLEGAL.has(ch) && ch.charCodeAt(0) >= 0x20)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPdfFilename({ fileName, tabName, intervals, period, connector }) {
  const parts = [];
  const file = baseNameNoExt(fileName);
  if (file) parts.push(file);
  if (tabName) parts.push(tabName);
  const range = formatRange(intervals, period, connector);
  if (range) parts.push(range);

  const name = sanitize(parts.join(' - '));
  return `${name || 'ledgerble'}.pdf`;
}

module.exports = { buildPdfFilename };
