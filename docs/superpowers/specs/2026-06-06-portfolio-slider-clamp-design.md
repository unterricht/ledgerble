# Portfolio Slider Clamp — Design Spec

**Date:** 2026-06-06
**Branch:** feature/redesign-quiet-ledger

## Problem

When a user includes a second ledger file (e.g. for stock purchases starting 2024)
alongside their main file (going back to 2015), the Portfolio tab shows a chart
spanning the full global date range — meaning ~9 years of zeros before the first
holding appears. The date-range slider also starts at 2015, offering no useful
minimum for the Portfolio view.

## Goal

The Portfolio tab's chart and its slider handle should automatically start at the
first date where the portfolio has a non-zero value, while still inheriting the
global slider's end date and any narrowing the user applies on other tabs.

## Decision: Ansatz C — one shared slider, Portfolio minimum clamped

All tabs share a single global date-range slider. Only the Portfolio tab enforces
a minimum start date (the first date any holding has value > 0). No new state is
needed — the clamp is purely derived.

Rejected alternatives:
- **Per-tab independent sliders (A)**: compute() would re-run on every tab switch;
  more state to manage.
- **Windowing moved into each adapter (B)**: larger refactor, all adapters change.

## Behaviour

| Scenario | Result |
|---|---|
| Global slider at [2015, 2026], switch to Portfolio | Chart and left handle start at first holding date (e.g. 2024-03) |
| User drags Portfolio slider left handle to 2024-Q3 | Global dateRange updated to [2024-Q3, 2026]; other tabs follow |
| Switch back to Balance | Balance shows [2024-Q3, 2026] (unchanged from last set value) |
| No non-base-currency holdings | `portfolioFirstKey = null` → no clamping, behaviour unchanged |

## Implementation

### 1. `src/data/adapters.js` — `buildPortfolio()`

After computing `totals` (per-interval market value array), find the first index
where `value > 0`:

```js
let firstMeaningfulIdx = totals.findIndex(t => t.value > 0);
if (firstMeaningfulIdx < 0) firstMeaningfulIdx = 0;
const portfolioFirstKey = totals[firstMeaningfulIdx]?.key ?? null;
const trimmedTotals = totals.slice(firstMeaningfulIdx);
```

Return `trimmedTotals` as `totals` and add `portfolioFirstKey` to the return object.

### 2. `src/app/Shell.jsx` — Inspector render block

When `view === 'portfolio'`, derive `portfolioMinIdx` from `portfolioFirstKey` and
pass clamped slider values to the Inspector:

```jsx
// Build portfolioVm once so we can read portfolioFirstKey
const portfolioVm = view === 'portfolio' && s.files.size > 0
  ? buildPortfolio(model)
  : null;

// Compute minimum slider index for Portfolio tab
const portfolioMinIdx = (() => {
  if (view !== 'portfolio' || !portfolioVm?.portfolioFirstKey) return 0;
  const idx = (model.fullIntervals || []).indexOf(portfolioVm.portfolioFirstKey);
  return idx >= 0 ? idx : 0;
})();

// Clamped slider values shown in Inspector when on Portfolio tab
const inspectorSliderValues = portfolioMinIdx > 0
  ? [Math.max(model.sliderValues[0], portfolioMinIdx), model.sliderValues[1]]
  : model.sliderValues;

// Wrapped onRangeChange that enforces the Portfolio minimum
const onRangeChangeForTab = (from, to) => {
  const clampedFrom = view === 'portfolio' ? Math.max(from, portfolioMinIdx) : from;
  onRangeChange(clampedFrom, to);
};
```

Pass `inspectorSliderValues` and `onRangeChangeForTab` to Inspector instead of
the current `model.sliderValues` and `onRangeChange`.

Pass the already-built `portfolioVm` to `<PortfolioView>` directly (avoids a
second `buildPortfolio()` call).

## Files changed

- `src/data/adapters.js` — `buildPortfolio()`: trim totals, return `portfolioFirstKey`
- `src/app/Shell.jsx` — Inspector block: clamped slider values + wrapped handler

## Tests

- Unit test in `test/adapters.test.js` (or new `test/portfolio.test.js`):
  - `buildPortfolio` with holdings starting mid-range → `totals` trimmed, `portfolioFirstKey` correct
  - `buildPortfolio` with no holdings → `portfolioFirstKey = null`, `totals = []`
  - `buildPortfolio` where first interval already has value > 0 → no trimming
