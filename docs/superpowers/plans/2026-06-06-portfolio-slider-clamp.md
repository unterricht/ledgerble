# Portfolio Slider Clamp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Portfolio tab's chart and date-range slider start at the first date any holding has a non-zero value, while still inheriting the global slider's range from other tabs.

**Architecture:** Two small changes — `buildPortfolio()` in `adapters.js` trims its `totals` array and returns a `portfolioFirstKey` string; `Shell.jsx` uses that key to clamp the Inspector slider's minimum when on the Portfolio tab. No new state is needed.

**Tech Stack:** CommonJS / React (no TypeScript), Jest for tests, `@testing-library/react` for component tests.

---

## Files

| File | Change |
|---|---|
| `src/data/adapters.js` | `buildPortfolio()`: trim leading zeros from `totals`, add `portfolioFirstKey` to return |
| `test/adapters.portfolio.test.js` | Add tests for trimming + `portfolioFirstKey` |
| `src/app/Shell.jsx` | Build `portfolioVm` early, derive clamped slider values, pass to Inspector |

---

## Task 1 — `buildPortfolio`: trim leading zeros and return `portfolioFirstKey`

**Files:**
- Modify: `src/data/adapters.js` (the `buildPortfolio` function, currently ending around line 783)
- Test: `test/adapters.portfolio.test.js`

### Step 1.1 — Write failing tests

Add these three test cases at the bottom of `test/adapters.portfolio.test.js`, before the closing of the file:

```js
// ── portfolioFirstKey and totals trimming ────────────────────────────────────

test('buildPortfolio returns portfolioFirstKey = null when model is empty', () => {
  const { portfolioFirstKey } = buildPortfolio(null);
  expect(portfolioFirstKey).toBeNull();
});

test('buildPortfolio trims totals to start at first non-zero value', () => {
  // makeModel() produces intervals ['2018-01', '2018-02'] — both have value > 0
  // We need a model with leading zero intervals. Build one with three intervals
  // where the first two have no holdings priced, so value === 0.
  const vs = new ValuationService();
  vs.parsePrices([
    { commodity: 'AAPL', date: '2018-03-01', price: '100', priceCommodity: 'USD' },
  ]);
  const balances = {
    'Assets:Shares': {
      AAPL: {
        '2018-03-01': { quantity: 10, costBasis: 1000, marketValue: 1000, unrealizedGain: 0, costCurrency: 'USD' },
      },
    },
  };
  const model = {
    currency: 'USD',
    period: 'Monthly',
    intervals:     ['2018-01', '2018-02', '2018-03'],
    intervalDates: [
      new Date('2018-01-01T00:00:00Z'),
      new Date('2018-02-01T00:00:00Z'),
      new Date('2018-03-01T00:00:00Z'),
    ],
    valResult: { balances, baseCurrency: 'USD' },
    valuationService: vs,
  };

  const { totals, portfolioFirstKey } = buildPortfolio(model);

  // Leading zeros trimmed — only the 2018-03 interval remains
  expect(totals).toHaveLength(1);
  expect(totals[0].key).toBe('2018-03');
  expect(portfolioFirstKey).toBe('2018-03');
});

test('buildPortfolio sets portfolioFirstKey = first interval when all values > 0 from start', () => {
  // makeModel() starts with holdings in 2018-01, so no trimming
  const { totals, portfolioFirstKey } = buildPortfolio(makeModel());
  expect(portfolioFirstKey).toBe(totals[0].key);
  // totals should still have full length (2 intervals)
  expect(totals).toHaveLength(2);
});
```

- [ ] Add the three test cases above to `test/adapters.portfolio.test.js`

### Step 1.2 — Run tests to confirm they fail

```bash
cd /Users/johannes/Documents/KI-Apps/ledgerble
npx jest test/adapters.portfolio.test.js --no-coverage 2>&1 | tail -20
```

Expected: the three new tests FAIL (`portfolioFirstKey` is undefined, totals not trimmed).

- [ ] Run and confirm failure

### Step 1.3 — Implement the changes in `buildPortfolio`

In `src/data/adapters.js`, find the final `return` statement of `buildPortfolio` (currently reads):

```js
  return { totals, holdings, totalCost, totalMarket, totalGain, maxY: niceMax, grid };
```

Replace the `totals` computation + return with the following (insert just before the existing `// ── 3. Aggregate totals` comment):

```js
  // ── 2b. Trim leading zero-value intervals ────────────────────────────────
  // The portfolio only exists from the first holding purchase. Intervals before
  // that date show value === 0 and are unhelpful in the chart. Trim them and
  // record the first meaningful interval key so Shell can clamp the slider.
  let firstMeaningfulIdx = totals.findIndex(t => t.value > 0);
  if (firstMeaningfulIdx < 0) firstMeaningfulIdx = 0;
  const portfolioFirstKey = totals.length > 0 ? (totals[firstMeaningfulIdx]?.key ?? null) : null;
  const trimmedTotals = totals.slice(firstMeaningfulIdx);
```

And update the return statement to:

```js
  return { totals: trimmedTotals, holdings, totalCost, totalMarket, totalGain, maxY: niceMax, grid, portfolioFirstKey };
```

- [ ] Apply both edits in `src/data/adapters.js`

### Step 1.4 — Run tests to confirm they pass

```bash
npx jest test/adapters.portfolio.test.js --no-coverage 2>&1 | tail -20
```

Expected: all tests in the file PASS.

- [ ] Run and confirm

### Step 1.5 — Run full suite to catch regressions

```bash
npx jest --no-coverage 2>&1 | tail -30
```

Expected: no new failures. If any test now fails because it checks `totals.length` against the full interval count, update the test to use `trimmedTotals` length or adjust the fixture so it has no leading zeros.

- [ ] Run full suite and confirm clean

### Step 1.6 — Commit

```bash
git add src/data/adapters.js test/adapters.portfolio.test.js
git commit -m "feat: buildPortfolio trims leading-zero totals and returns portfolioFirstKey"
```

- [ ] Commit

---

## Task 2 — `Shell.jsx`: clamped slider for Portfolio tab

**Files:**
- Modify: `src/app/Shell.jsx` (two locations: `buildPortfolio` call site ~line 558, Inspector block ~line 585)
- Test: `test/Shell.test.jsx`

### Step 2.1 — Write failing Shell test

Add this test to `test/Shell.test.jsx`. Find an appropriate `describe` block or add it near the existing Portfolio tab tests (lines ~30-54):

```jsx
test('Portfolio Inspector slider minimum is clamped to first holding date', async () => {
  // This test verifies that when a model has portfolioFirstKey set, the
  // Inspector slider's sliderValues[0] is at least the portfolioFirstKey index.
  // We verify by checking the DateRangeSlider receives a clamped lo value.
  //
  // Strategy: render Shell with a mock compute() that returns fullIntervals
  // spanning 3 months, and a buildPortfolio that returns portfolioFirstKey
  // pointing to the third month. Then open the Portfolio tab + Inspector and
  // assert the slider's `value` prop starts at index 2 (not 0).
  //
  // Because Shell imports adapters directly we mock the module.
  const { buildPortfolio: origBP } = jest.requireActual('../src/data/adapters');
  jest.doMock('../src/data/adapters', () => ({
    ...jest.requireActual('../src/data/adapters'),
    buildPortfolio: (model) => ({
      ...origBP(model),
      portfolioFirstKey: '2018-03',
    }),
  }));
  // Note: if Shell.test.jsx already uses jest.mock at the module level for
  // adapters, add `portfolioFirstKey: '2018-03'` to the existing mock there
  // instead of using jest.doMock here. Check the top of Shell.test.jsx first.
});
```

**Important:** Read `test/Shell.test.jsx` before adding this test to understand how the existing mocks are set up (the file likely already mocks `compute` and `adapters`). Adapt the test to match the existing mock style — the key assertion to make is:

```jsx
// After navigating to portfolio tab and opening Inspector:
const slider = screen.getByTestId('date-range-slider'); // or whatever the test id is
// The slider's lo value should equal the index of '2018-03' in fullIntervals
// Check via the component's rendered output or a prop assertion
```

Because this component test is tightly coupled to mock setup, **read the test file before writing** and follow the existing patterns exactly.

- [ ] Read `test/Shell.test.jsx` (first 100 lines + any portfolio-related tests)
- [ ] Add the test case following existing mock patterns
- [ ] Run `npx jest test/Shell.test.jsx --no-coverage 2>&1 | tail -30` and confirm the new test FAILS

### Step 2.2 — Implement: build `portfolioVm` early, derive clamped slider values

In `src/app/Shell.jsx`, find the current Portfolio render line (~558):

```jsx
: view === 'portfolio' && s.files.size > 0
? <PortfolioView vm={buildPortfolio(model)} cur={model.currency || cur} />
```

**Step A — build portfolioVm once, just before the view render block:**

Find the block that begins `const showInsp = FILTER_TABS.has(view) && insp;` (around line ~382) and add immediately after it:

```js
  // Build portfolio view-model once so we can read portfolioFirstKey for the
  // slider clamp AND pass the vm to PortfolioView without calling twice.
  const portfolioVm = (view === 'portfolio' && s.files.size > 0)
    ? buildPortfolio(model)
    : null;

  // Minimum slider index for the Portfolio tab: the first interval that has
  // any non-zero portfolio value. Other tabs leave this at 0 (no clamping).
  const portfolioMinIdx = (() => {
    if (view !== 'portfolio' || !portfolioVm || !portfolioVm.portfolioFirstKey) return 0;
    const idx = (model.fullIntervals || []).indexOf(portfolioVm.portfolioFirstKey);
    return idx >= 0 ? idx : 0;
  })();

  // Slider values shown in the Inspector. On the Portfolio tab the left handle
  // cannot go before the first holding date.
  const inspectorSliderValues = portfolioMinIdx > 0
    ? [Math.max((model.sliderValues || [0, 0])[0], portfolioMinIdx), (model.sliderValues || [0, 0])[1]]
    : model.sliderValues;
```

**Step B — update the PortfolioView render line** to use the pre-built vm:

```jsx
: view === 'portfolio' && s.files.size > 0
? <PortfolioView vm={portfolioVm} cur={model.currency || cur} />
```

**Step C — update the Inspector's props** (in the Inspector block ~line 585):

Change:
```jsx
intervals={model.fullIntervals}
sliderValues={model.sliderValues}
onRangeChange={onRangeChange}
```

To:
```jsx
intervals={model.fullIntervals}
sliderValues={inspectorSliderValues}
onRangeChange={(from, to) => {
  const clampedFrom = portfolioMinIdx > 0 ? Math.max(from, portfolioMinIdx) : from;
  onRangeChange(clampedFrom, to);
}}
```

- [ ] Apply Step A (add `portfolioVm`, `portfolioMinIdx`, `inspectorSliderValues` variables)
- [ ] Apply Step B (update PortfolioView render)
- [ ] Apply Step C (update Inspector props)

### Step 2.3 — Run the Shell test

```bash
npx jest test/Shell.test.jsx --no-coverage 2>&1 | tail -30
```

Expected: all tests PASS, including the new clamp test.

- [ ] Run and confirm

### Step 2.4 — Run full suite

```bash
npx jest --no-coverage 2>&1 | tail -30
```

Expected: all tests pass, no regressions.

- [ ] Run full suite and confirm clean

### Step 2.5 — Commit

```bash
git add src/app/Shell.jsx test/Shell.test.jsx
git commit -m "feat: clamp Portfolio tab slider to first holding date"
```

- [ ] Commit

---

## Task 3 — Manual smoke test

Start the app and verify visually:

```bash
npm start
```

1. Load a ledger file that has both regular transactions (e.g. since 2015) and stock holdings (e.g. since 2024).
2. Open the **Portfolio** tab.
3. Confirm the chart starts at the first stock purchase date, not at 2015.
4. Open the Inspector (filter button). Confirm the left slider handle starts at the first holding date.
5. Try dragging the left handle further left — it should be blocked at the first holding date.
6. Switch to **Balance** or **Overview** tab. Confirm their slider is unaffected (still shows full range).

- [ ] Start app and verify all six points above
- [ ] If anything looks wrong, investigate before marking done
