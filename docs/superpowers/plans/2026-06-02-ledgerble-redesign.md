# Ledgerble „Quiet Ledger" Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Ledgerble's jQuery/Bootstrap renderer with a React-based „Quiet Ledger" UI that matches the Claude Design mockup, while keeping the existing data layer (ledger parsing, valuation, i18n, settings) intact.

**Architecture:** Two-process Electron app stays. The **main process** (parsing, settings, menu) is extended only for platform-adaptive window chrome. The **renderer** is rewritten as React components ported near-verbatim from the mockup, fed by pure-function *adapters* that transform the existing `postings` / `valuation` output into the view-models the components expect. A small React store subscribes to `window.api.onParsed`; no more `window.update`/`window.state` globals.

**Tech Stack:** Electron 35, React 18 (via esbuild JSX), ECharts 5 (re-themed), Jest + React Testing Library + jsdom. CommonJS + JSX. ledger-cli/hledger unchanged.

---

## Conventions for this plan

- **Spec:** `docs/superpowers/specs/2026-06-02-ledgerble-redesign-design.md`. Read it first.
- **Design source of truth (local only, gitignored):** `Entwicklung/redesign/project/ui_kits/ledgerble/`
  contains the final mockup (`rd-base.jsx`, `rd-charts.jsx`, `rd-views.jsx`, `rd-views2.jsx`,
  `rd-shell.jsx`). When a task says **„port from `<file>:<Component>`"**, open that file, copy the
  component, and apply the listed adaptations. The verbatim JSX bodies live there; this plan does not
  re-paste them — it specifies the *seams* (props, data wiring, i18n, tests).
- **Final tokens** are in `rd-base.jsx`'s `T` object (graphite + pine `#2E6E5D`). The warm
  `colors_and_type.css` palette was rejected and deleted — do not use it.
- **TDD is mandatory** (red/green). Logic/adapters → Jest node tests. Components → RTL + jsdom.
- **Branch:** `feature/redesign-quiet-ledger` (already created). Commit after every passing task.
- **Re-bundle to see changes:** `npm run bundle` (or `npm start`). Editing renderer JS without
  bundling appears to do nothing.
- **Do not touch** (keep + keep green): `valuation.js`, `accountFilter.js`, `hledger.js`, `i18n.js`
  core logic, `main.js` parsing, `menu.js` logic, and their tests, unless a task says otherwise.

## Target renderer file structure

```
src/
├── app/
│   ├── index.jsx           # esbuild entry: imports store + Shell, ReactDOM.createRoot
│   └── Shell.jsx           # platform chrome, source-list nav, toolbar, inspector, routing
├── store/
│   └── useAppState.js      # React context/hook: files, currency, period, query, view, filters
├── data/
│   ├── adapters.js         # buildOverview, buildBreakdownTree, buildBalanceTree, buildAssets, buildPortfolio
│   ├── pickCats.js         # top-N / 75%-of-spend / all selection + Other row
│   └── postingsFilter.js   # search + type filter
├── charts/
│   ├── IncomeExpensesChart.jsx  # ECharts bar + purple net line (re-themed)
│   ├── AreaLineChart.jsx        # ECharts area lines (assets/portfolio)
│   └── BarBreakdown.jsx         # HTML/CSS ranked bars w/ drill-down (NOT a chart)
├── views/
│   ├── OverviewView.jsx
│   ├── BalanceView.jsx
│   ├── ExpensesIncomeView.jsx   # Visual/Text toggle (was TreemapView)
│   ├── AssetsView.jsx
│   ├── PortfolioView.jsx
│   ├── PostingsView.jsx
│   └── OptionsView.jsx
└── ui/
    ├── tokens.js          # T (tokens), money(), kfmt()  [ported from rd-base.jsx]
    ├── Icon.jsx           # monoline SVG icons          [ported from rd-base.jsx]
    └── controls.jsx       # Segmented, Eyebrow, Num, MenuSelect [ported from rd-base/rd-shell]
```

The old renderer files (`ui.js`, `treeMap.js`, `balance.js`, `assets.js`, `portfolio.js`,
`incomeExpenses.js`, `postings.js`, `treeTable.js`, `toggle.js`, `tabVisibility.js`,
`dateRangeSelector.js`, `currency.js`, `accountFilter.js`'s render half) are **removed in Phase 7**,
not before — keep them until their replacements are wired so the app keeps building.

---

## Phase 1 — Build foundation (React + JSX + jsdom)

### Task 1.1: Add React + test deps, enable JSX in esbuild

**Files:**
- Modify: `package.json:61-86` (dependencies / devDependencies)
- Modify: `esbuild.config.mjs:8-25`

- [ ] **Step 1: Install runtime + dev deps**

Run:
```bash
npm install react@^18.3.1 react-dom@^18.3.1
npm install -D jsdom@^25.0.0 jest-environment-jsdom@^29.7.0 \
  @testing-library/react@^16.0.0 @testing-library/jest-dom@^6.4.0 \
  @testing-library/user-event@^14.5.0
```
Expected: deps appear in `package.json`, no errors.

- [ ] **Step 2: Point esbuild at the new React entry + enable JSX automatic runtime**

In `esbuild.config.mjs`, change `entryPoints: ['ui.js']` → `entryPoints: ['src/app/index.jsx']`
and add JSX options to the `build({...})` call:
```js
  entryPoints: ['src/app/index.jsx'],
  bundle: true,
  outfile: 'dist/bundle.js',
  platform: 'browser',
  format: 'iife',
  external: ['electron'],
  jsx: 'automatic',
  loader: { '.js': 'jsx', '.jsx': 'jsx' },
  define: { 'process.env.NODE_ENV': '"production"' },
  sourcemap: true,
  minify: false,
  logLevel: 'info',
```

- [ ] **Step 3: Create the entry so the bundle builds**

Create `src/app/index.jsx`:
```jsx
import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
root.render(<div style={{ fontFamily: 'system-ui', padding: 24 }}>Quiet Ledger — booting…</div>);
```

- [ ] **Step 4: Verify the bundle builds**

Run: `npm run bundle`
Expected: `✅ Bundle built: dist/bundle.js`, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json esbuild.config.mjs src/app/index.jsx
git commit -m "build: add React + RTL/jsdom, point esbuild at src/app entry"
```

### Task 1.2: Jest multi-environment config (node for logic, jsdom for components)

**Files:**
- Create: `jest.config.js`
- Test: `test/setup-jsdom.js`

- [ ] **Step 1: Write a jsdom smoke test (red)**

Create `test/smoke.dom.test.js`:
```js
/** @jest-environment jsdom */
const { render, screen } = require('@testing-library/react');
const React = require('react');
require('@testing-library/jest-dom');

test('RTL + jsdom render works', () => {
  render(React.createElement('h1', null, 'hi'));
  expect(screen.getByText('hi')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it — expect failure (no jest config / matchers)**

Run: `npx jest test/smoke.dom.test.js`
Expected: FAIL (toBeInTheDocument not a function, or transform error on JSX in deps).

- [ ] **Step 3: Add Jest config with per-file environment + babel for JSX in tests**

Install babel for transforming JSX in test files:
```bash
npm install -D babel-jest @babel/preset-env @babel/preset-react
```
Create `babel.config.js`:
```js
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
};
```
Create `jest.config.js`:
```js
module.exports = {
  testEnvironment: 'node',          // default; component tests opt in via docblock
  setupFilesAfterEnv: ['<rootDir>/test/setup-jsdom.js'],
  transform: { '^.+\\.(js|jsx)$': 'babel-jest' },
  testMatch: ['<rootDir>/test/**/*.test.js', '<rootDir>/test/**/*.test.jsx'],
};
```
Create `test/setup-jsdom.js`:
```js
// Only loads jest-dom matchers; harmless in node env.
require('@testing-library/jest-dom');
```
Component test files declare `/** @jest-environment jsdom */` at the top.

- [ ] **Step 4: Run smoke + full suite**

Run: `npx jest test/smoke.dom.test.js` → Expected: PASS.
Run: `npm test` → Expected: existing suite still green (valuation, accountFilter, hledger, i18n,
menu, print, options, treeMap, tabVisibility, portfolio).

> If any pre-existing test breaks due to the babel transform, classify it (test-defect vs
> app-defect) per the project standard and report before continuing.

- [ ] **Step 5: Commit**

```bash
git add jest.config.js babel.config.js test/setup-jsdom.js test/smoke.dom.test.js package.json package-lock.json
git commit -m "test: add jest jsdom+node config with RTL and babel JSX transform"
```

### Task 1.3: Port design tokens + money/kfmt helpers

**Files:**
- Create: `src/ui/tokens.js`
- Test: `test/tokens.test.js`

- [ ] **Step 1: Write failing tests for money()/kfmt()**

Create `test/tokens.test.js`:
```js
const { T, money, kfmt } = require('../src/ui/tokens');

test('T exposes pine accent and net color', () => {
  expect(T.pine).toBe('#2E6E5D');
});
test('money formats positive USD with cents', () => {
  expect(money(1234.5, { cur: 'USD' })).toBe('$1,234.50');
});
test('money formats negative as parentheses by default', () => {
  expect(money(-50, { cur: 'USD' })).toBe('($50.00)');
});
test('money with sign uses minus glyph for negative', () => {
  expect(money(-50, { cur: 'USD', sign: true })).toBe('−$50.00');
});
test('kfmt abbreviates thousands', () => {
  expect(kfmt(7800, 'USD')).toBe('$7.8k');
  expect(kfmt(10000, 'USD')).toBe('$10k');
});
```

- [ ] **Step 2: Run — expect failure (module missing)**

Run: `npx jest test/tokens.test.js`
Expected: FAIL "Cannot find module '../src/ui/tokens'".

- [ ] **Step 3: Port tokens from the mockup**

Create `src/ui/tokens.js` by copying the `T` object, `T_CHART`, `CUR`, `money`, `kfmt` from
`Entwicklung/redesign/project/ui_kits/ledgerble/rd-base.jsx:7-65`. Export them CommonJS-style:
```js
// ...the T object, T_CHART (assign T.chart), CUR, money, kfmt verbatim from rd-base.jsx...
module.exports = { T, money, kfmt };
```
Keep `T.sans`/`T.mono` as `'var(--rd-sans)'` / `'var(--rd-mono)'` (the Shell sets these CSS vars).

- [ ] **Step 4: Run — expect pass**

Run: `npx jest test/tokens.test.js` → Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/tokens.js test/tokens.test.js
git commit -m "feat: port Quiet Ledger design tokens + money/kfmt helpers"
```

### Task 1.4: Port atom components (Icon, Segmented, Eyebrow, Num)

**Files:**
- Create: `src/ui/Icon.jsx`, `src/ui/controls.jsx`
- Test: `test/ui-atoms.test.jsx`

- [ ] **Step 1: Write failing component tests**

Create `test/ui-atoms.test.jsx`:
```jsx
/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Icon } from '../src/ui/Icon';
import { Segmented, Eyebrow, Num } from '../src/ui/controls';

test('Icon renders an svg for a known name', () => {
  const { container } = render(<Icon name="search" />);
  expect(container.querySelector('svg')).toBeInTheDocument();
});
test('Segmented marks active option and fires onChange', async () => {
  const onChange = jest.fn();
  render(<Segmented options={[{value:'a',label:'A'},{value:'b',label:'B'}]} value="a" onChange={onChange} />);
  await userEvent.click(screen.getByText('B'));
  expect(onChange).toHaveBeenCalledWith('b');
});
test('Num renders children', () => {
  render(<Num>$10.00</Num>);
  expect(screen.getByText('$10.00')).toBeInTheDocument();
});
test('Eyebrow renders label text', () => {
  render(<Eyebrow>Accounts</Eyebrow>);
  expect(screen.getByText('Accounts')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npx jest test/ui-atoms.test.jsx`
Expected: FAIL (modules missing).

- [ ] **Step 3: Port the atoms**

Create `src/ui/Icon.jsx`: copy `ICON_PATHS` + `Icon` from `rd-base.jsx:70-99`. Replace the implicit
global `T`/React with imports:
```jsx
import React from 'react';
// ICON_PATHS verbatim from rd-base.jsx
export function Icon({ name, size = 16, stroke = 'currentColor', sw = 1.6, fill = 'none', style }) { /* body verbatim */ }
```
Create `src/ui/controls.jsx`: copy `Segmented` (`rd-base.jsx:104-131`), `Eyebrow` (`:136-143`),
`Num` (`:146-154`), and `MenuSelect` (`rd-shell.jsx:77-88`) and `SearchField` (`rd-shell.jsx:91-99`).
Each needs `import React from 'react';` and `import { T } from './tokens';` and `import { Icon } from './Icon';`. Export all named.

- [ ] **Step 4: Run — expect pass**

Run: `npx jest test/ui-atoms.test.jsx` → Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/Icon.jsx src/ui/controls.jsx test/ui-atoms.test.jsx
git commit -m "feat: port UI atoms (Icon, Segmented, Eyebrow, Num, MenuSelect, SearchField)"
```

---

## Phase 2 — Window chrome, IPC, store, and Shell

### Task 2.1: Platform-adaptive BrowserWindow + window-control IPC (main process)

**Files:**
- Modify: `main.js:33-64` (createWindow), add IPC handlers near `main.js:271`
- Modify: `preload.js:13-62`
- Test: `test/window-chrome.test.js`

- [ ] **Step 1: Write a failing unit test for the chrome-options helper**

We extract the platform-specific BrowserWindow options into a pure, testable function.
Create `test/window-chrome.test.js`:
```js
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
```

- [ ] **Step 2: Run — expect failure**

Run: `npx jest test/window-chrome.test.js`
Expected: FAIL "Cannot find module '../windowChrome'".

- [ ] **Step 3: Implement the helper**

Create `windowChrome.js` (repo root, alongside `main.js`):
```js
// Platform-adaptive BrowserWindow chrome options. Pure function so it is unit-testable.
function windowOptionsFor(platform) {
  if (platform === 'darwin') {
    // Native traffic lights stay; our unified toolbar sits beside them. Native menu bar kept.
    return { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 16 } };
  }
  if (platform === 'win32') {
    // Frameless: we draw our own window controls + in-window menu bar.
    return { frame: false };
  }
  return {}; // Linux: native frame
}
module.exports = { windowOptionsFor };
```

- [ ] **Step 4: Run — expect pass**

Run: `npx jest test/window-chrome.test.js` → Expected: PASS (3 tests).

- [ ] **Step 5: Wire it into createWindow + add window-control IPC**

In `main.js`, add at top: `const { windowOptionsFor } = require('./windowChrome')`.
Change the `new BrowserWindow({...})` call (`main.js:35-44`) to merge platform options:
```js
  win = new BrowserWindow({
    width: 1500,
    height: 1150,
    ...windowOptionsFor(process.platform),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  })
```
Add window-control IPC handlers (near the other `ipcMain` blocks, after `main.js:113`):
```js
// ── IPC: custom window controls (Windows frameless chrome) ──
ipcMain.on('window:minimize', () => { if (win) win.minimize(); });
ipcMain.on('window:maximize', () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on('window:close', () => { if (win) win.close(); });
```

- [ ] **Step 6: Expose controls + platform in preload**

In `preload.js`, inside the `exposeInMainWorld('api', { ... })` object, add:
```js
  platform: process.platform,
  windowControls: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
```

- [ ] **Step 7: Update preload test if present, run suite**

Run: `npm test` → Expected: green. If `test/preload.test.js` asserts the shape of `window.api`,
add `platform`/`windowControls` to its expectations (test-defect classification: intentional API growth).

- [ ] **Step 8: Add windowChrome.js to electron-builder files list**

In `package.json` `build.files` array (`package.json:46-59`), add `"windowChrome.js",`.

- [ ] **Step 9: Commit**

```bash
git add main.js preload.js windowChrome.js package.json test/window-chrome.test.js test/preload.test.js
git commit -m "feat: platform-adaptive window chrome + window-control IPC"
```

### Task 2.2: App state store (subscribes to parsed results)

**Files:**
- Create: `src/store/useAppState.js`
- Test: `test/useAppState.test.jsx`

The store owns: `files` (Map path→FileState), runtime UI state (`currency`, `period`, `dateRange`,
`query`, `view`, `deselectedAccounts`, `inspectorOpen`, `postingType`), and the derived
`viewModel` (computed via `useMemo` from files + valuation + adapters — wired in later phases).
It mirrors the old `ui.js` `onParsed` handler (`ui.js:179-196`) but as React state.

- [ ] **Step 1: Write failing test for the reducer/derivations**

Create `test/useAppState.test.jsx`:
```jsx
/** @jest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { useAppState } from '../src/store/useAppState';

beforeEach(() => {
  global.window.api = {
    onParsed: (cb) => { global.__emitParsed = cb; },
    settings: { getAll: async () => ({}), get: async () => [], set: () => {} },
    platform: 'darwin',
  };
});

test('typing a query routes the view to postings', () => {
  const { result } = renderHook(() => useAppState());
  act(() => result.current.setQuery('rent'));
  expect(result.current.query).toBe('rent');
  expect(result.current.view).toBe('postings');
});

test('setQuery("") does not force postings view', () => {
  const { result } = renderHook(() => useAppState());
  act(() => { result.current.setView('balance'); result.current.setQuery(''); });
  expect(result.current.view).toBe('balance');
});

test('onParsed callback stores a file result', () => {
  const { result } = renderHook(() => useAppState());
  act(() => global.__emitParsed('cody.journal', { postings: [], postingsCost: [], prices: [] }, null));
  expect(result.current.files.has('cody.journal')).toBe(true);
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npx jest test/useAppState.test.jsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement the store hook**

Create `src/store/useAppState.js`:
```js
import { useState, useEffect, useCallback, useRef } from 'react';

// FileState mirrors ui.js:63-76
function makeFileState(error, data) {
  if (data && data.postings) return { error, postings: data.postings, postingsCost: data.postingsCost || [], prices: data.prices || [] };
  return { error, postings: data || [], postingsCost: [], prices: [] };
}

export function useAppState() {
  const [files, setFiles] = useState(() => new Map());
  const [currency, setCurrency] = useState('USD');
  const [period, setPeriod] = useState('Monthly');
  const [dateRange, setDateRange] = useState(null);     // [fromIdx, toIdx] | null
  const [query, setQueryRaw] = useState('');
  const [view, setView] = useState('overview');
  const [deselectedAccounts, setDeselected] = useState(() => new Set());
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [postingType, setPostingType] = useState('all');

  // search routes to postings (mirrors rd-shell.jsx onSearch)
  const setQuery = useCallback((v) => {
    setQueryRaw(v);
    setView((cur) => (v && cur !== 'postings' ? 'postings' : cur));
  }, []);

  const toggleAccount = useCallback((path) => {
    setDeselected((p) => { const n = new Set(p); n.has(path) ? n.delete(path) : n.add(path); return n; });
  }, []);

  // subscribe to parsed results once
  useEffect(() => {
    if (!window.api || !window.api.onParsed) return;
    window.api.onParsed((file, result, error) => {
      setFiles((prev) => { const n = new Map(prev); n.set(file, makeFileState(error, result)); return n; });
    });
  }, []);

  return {
    files, setFiles,
    currency, setCurrency,
    period, setPeriod,
    dateRange, setDateRange,
    query, setQuery,
    view, setView,
    deselectedAccounts, toggleAccount, setDeselected,
    inspectorOpen, setInspectorOpen,
    postingType, setPostingType,
  };
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx jest test/useAppState.test.jsx` → Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/useAppState.js test/useAppState.test.jsx
git commit -m "feat: app state store with parsed-result subscription and search routing"
```

### Task 2.3: Shell — chrome, source-list nav, toolbar, inspector (placeholder views)

**Files:**
- Create: `src/app/Shell.jsx`
- Modify: `src/app/index.jsx`
- Modify: `index.html` (reduce to root + base styles)
- Test: `test/Shell.test.jsx`

Port the Shell structure from `rd-shell.jsx` but: (a) drive `platform` from `window.api.platform`
instead of the tweaks toggle; (b) drop `useTweaks`/`TweaksPanel`/`tweaks-panel.jsx` entirely;
(c) fix net color to `#7A47C2` and catRule from settings (wired later); (d) replace the mock
`ACCT_TREE`/`ALL_PATHS` with props from the store (wired in Phase 3+, render an empty inspector for now);
(e) render placeholder `<div data-view={view}/>` for each view (real views land in later phases).

- [ ] **Step 1: Write failing Shell tests**

Create `test/Shell.test.jsx`:
```jsx
/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shell } from '../src/app/Shell';

beforeEach(() => {
  window.api = { onParsed: () => {}, settings: { getAll: async () => ({}), get: async () => [], set: () => {} },
                 windowControls: { minimize(){}, maximize(){}, close(){} }, platform: 'darwin' };
});

test('renders the source-list nav with all report items', () => {
  render(<Shell />);
  ['Income & Expenses','Balance','Expenses','Income','Assets & Liabilities','Portfolio','Postings','Options']
    .forEach(l => expect(screen.getByText(l)).toBeInTheDocument());
});

test('clicking a nav item switches the active view', async () => {
  render(<Shell />);
  await userEvent.click(screen.getByText('Balance'));
  expect(document.querySelector('[data-view="balance"]')).toBeInTheDocument();
});

test('macOS does not render custom window controls', () => {
  render(<Shell />);
  expect(screen.queryByTestId('win-controls')).not.toBeInTheDocument();
});

test('Windows renders custom window controls', () => {
  window.api.platform = 'win32';
  render(<Shell />);
  expect(screen.getByTestId('win-controls')).toBeInTheDocument();
});

test('typing in search switches to postings view', async () => {
  render(<Shell />);
  await userEvent.type(screen.getByPlaceholderText(/search/i), 'rent');
  expect(document.querySelector('[data-view="postings"]')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npx jest test/Shell.test.jsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement Shell.jsx**

Create `src/app/Shell.jsx`. Port `NAV`, `TITLES`, `FILTER_TABS`, `PERIOD_TABS`, `TrafficLights`,
`WinControls`, `NavItem`, `JournalFooter`, `FileMenu`, `MacMenuBar`, `Inspector`, and the `Shell`
layout from `rd-shell.jsx`. Apply these adaptations:
- Replace `const [tw, setTweak] = useTweaks(...)` + `const plat = tw.platform === 'Windows' ? 'win' : 'mac'`
  with `const plat = window.api.platform === 'win32' ? 'win' : 'mac';`.
- Replace `const netColor = tw.netColor || T.net;` with `const netColor = '#7A47C2';`.
- Replace `tw.catRule` usage with a `catRule` value (hardcode `'top5'` here; Phase 6 wires it to settings).
- Use the store: `const s = useAppState();` and read/write `view`, `currency`, `period`, `query`,
  `inspectorOpen`, `postingType`, `deselectedAccounts` from it instead of local `useState`.
- Add `data-testid="win-controls"` to the `WinControls` wrapper `<div>`.
- In `content()`, render `<div data-view={view} />` placeholders for now (no view imports yet).
- Wire `WinControls` buttons to `window.api.windowControls.{minimize,maximize,close}`.
- Remove the `<TweaksPanel>…</TweaksPanel>` block at the end of `Shell`.
- `import React from 'react'; import { useAppState } from '../store/useAppState'; import { T, money, kfmt } from '../ui/tokens'; import { Icon } from '../ui/Icon'; import { Segmented, Eyebrow, Num, MenuSelect, SearchField } from '../ui/controls';`
- `export { Shell };`

- [ ] **Step 4: Mount Shell + reduce index.html**

Replace `src/app/index.jsx` body:
```jsx
import { createRoot } from 'react-dom/client';
import { Shell } from './Shell';
createRoot(document.getElementById('root')).render(<Shell />);
```
Rewrite `index.html` to the minimal shell: keep the CSP meta, drop all vendor `<link>`s and the
entire `<body>` markup, leaving `<div id="root"></div>` + `<script src="dist/bundle.js">`. Move the
base styles (box-sizing reset, `html,body{height:100%}`, the desktop gradient background, slim
scrollbars, focus ring, and the `@media print` rules) from `Ledgerble Redesign.html:7-61` into a
`<style>` block. Set CSS vars `--rd-sans`/`--rd-mono` on `:root` to the system stacks. Keep
`<title>Ledgerble</title>`.

- [ ] **Step 5: Run Shell tests + build**

Run: `npx jest test/Shell.test.jsx` → Expected: PASS (5 tests).
Run: `npm run bundle` → Expected: builds clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/Shell.jsx src/app/index.jsx index.html test/Shell.test.jsx
git commit -m "feat: Quiet Ledger Shell — platform chrome, source-list nav, toolbar, inspector"
```

---

## Phase 3 — Overview (the data seam + first real view)

This phase builds the **data seam** all views share, then the Overview view on top of it.

### Task 3.1: typeExtractor from settings regexes

**Files:**
- Create: `src/data/typeExtractor.js`
- Test: `test/typeExtractor.test.js`

Mirrors `ui.js:118-142` but as a pure factory taking a `getSetting`-like function, so it is testable
without the renderer.

- [ ] **Step 1: Failing test**

Create `test/typeExtractor.test.js`:
```js
const { makeTypeExtractor } = require('../src/data/typeExtractor');
const settings = {
  'options.expenses.regex': '^expenses?(:|$)',
  'options.income.regex': '^(income|revenue)s?(:|$)',
  'options.assets.regex': '^assets?(:|$)',
  'options.liabilities.regex': '^(debts?|liabilit(y|ies))(:|$)',
  'options.equity.regex': '^equity(:|$)',
};
const te = makeTypeExtractor((k) => settings[k]);

test('classifies expenses/income/assets/liabilities/equity', () => {
  expect(te('Expenses:Groceries')).toBe('expenses');
  expect(te('Income:Salary')).toBe('income');
  expect(te('Assets:Savings')).toBe('assets');
  expect(te('Liabilities:Mortgage')).toBe('liabilities');
  expect(te('Equity:Opening')).toBe('equity');
});
test('unknown falls through', () => {
  expect(te('Foo:Bar')).toBe('unknown');
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx jest test/typeExtractor.test.js`

- [ ] **Step 3: Implement**

Create `src/data/typeExtractor.js`:
```js
function makeTypeExtractor(getSetting) {
  return (accountString) => {
    const tests = [
      ['options.expenses.regex', 'expenses'],
      ['options.income.regex', 'income'],
      ['options.assets.regex', 'assets'],
      ['options.liabilities.regex', 'liabilities'],
      ['options.equity.regex', 'equity'],
    ];
    for (const [key, type] of tests) {
      const rx = getSetting(key);
      if (rx && accountString.match(new RegExp(rx, 'i'))) return type;
    }
    return 'unknown';
  };
}
module.exports = { makeTypeExtractor };
```

- [ ] **Step 4: Run — expect PASS.** `npx jest test/typeExtractor.test.js`

- [ ] **Step 5: Commit**
```bash
git add src/data/typeExtractor.js test/typeExtractor.test.js
git commit -m "feat: pure typeExtractor factory from settings regexes"
```

### Task 3.2: compute() — valuation, intervals, balances (mirrors ui.js update)

**Files:**
- Create: `src/data/compute.js`
- Test: `test/compute.test.js`

`compute()` ports the data-prep half of `ui.js update()` (`ui.js:229-378`): merge postings across
files, run `ValuationService`, build daily→period intervals, per-account balance series, market-value
substitution, and the date-range filter. It is a **pure function** (no DOM, no globals) returning a
model the adapters consume.

- [ ] **Step 1: Failing test (small synthetic journal)**

Create `test/compute.test.js`:
```js
const { compute } = require('../src/data/compute');
const { makeTypeExtractor } = require('../src/data/typeExtractor');

const te = makeTypeExtractor((k) => ({
  'options.expenses.regex': '^expenses?(:|$)',
  'options.income.regex': '^(income|revenue)s?(:|$)',
  'options.assets.regex': '^assets?(:|$)',
  'options.liabilities.regex': '^(debts?|liabilit(y|ies))(:|$)',
  'options.equity.regex': '^equity(:|$)',
}[k]));

function p(date, accounts, amount, currency = 'USD') {
  return { date, accounts, amount, currency };
}
const postings = [
  p('2018-01-15', ['Income','Salary'], -1000),
  p('2018-01-15', ['Assets','Bank'], 1000),
  p('2018-02-10', ['Expenses','Food'], 200),
  p('2018-02-10', ['Assets','Bank'], -200),
];

test('compute returns typed, date-bucketed postings and a base currency', () => {
  const files = new Map([['j', { postings, postingsCost: [], prices: [] }]]);
  const m = compute({ files, currency: 'USD', period: 'Monthly', deselectedAccounts: new Set(), dateRange: null, typeExtractor: te });
  expect(m.currency).toBe('USD');
  expect(m.postings.every(x => x.type)).toBe(true);
  expect(m.intervals.length).toBeGreaterThan(0);
  const food = m.postings.find(x => x.accounts.join(':') === 'Expenses:Food');
  expect(food.type).toBe('expenses');
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx jest test/compute.test.js`

- [ ] **Step 3: Implement compute()**

Create `src/data/compute.js`. Port the body of `ui.js update()` from `ui.js:229-378`, with these changes:
- Signature: `function compute({ files, currency, period, deselectedAccounts, dateRange, typeExtractor })`.
- `require('./valuation')` → `require('../../valuation')` (repo-root module stays).
- `require('../../accountFilter')` for `filterPostings`/`buildAccountTree`.
- Replace `state.dateFormat` with a local `dateFormat` derived from `period` (port the period→format
  logic; if it currently lives in `dateRangeSelector.js`, copy the formatter map here:
  Daily=`YYYY-MM-DD`, Weekly=ISO week, Monthly=`YYYY-MM`, Quarterly=`YYYY-Q`, Yearly=`YYYY`, using
  `moment.utc`). Add `require('moment')`.
- Postings arrive from the store with `date` as a `YYYY-MM-DD` string; convert to `Date(str+'T00:00:00Z')`
  and attach `type = typeExtractor(accounts.join(':'))`, `accountsFmtd()`, `dateFmtd()` exactly as
  `ui.js:184-191`.
- Drop all `$(...)`/DOM and chart calls — return data only.
- `dateRange` (`[fromIdx,toIdx]` or null) replaces the slider; default to full range when null.
- Return: `{ currency, currencies, postings, rawPostings, intervals, intervalDates, balances, valResult, accountTree, sliderValues }`.

> This is the most logic-dense task. Keep `valuation.js` untouched; only relocate the orchestration.

- [ ] **Step 4: Run — expect PASS.** `npx jest test/compute.test.js`
- [ ] **Step 5: Commit**
```bash
git add src/data/compute.js test/compute.test.js
git commit -m "feat: pure compute() data seam (valuation + intervals + balances)"
```

### Task 3.3: pickCats (top-N / 75% / all + Other row)

**Files:**
- Create: `src/data/pickCats.js`
- Test: `test/pickCats.test.js`

- [ ] **Step 1: Failing test**

Create `test/pickCats.test.js`:
```js
const { pickCats } = require('../src/data/pickCats');
const rows = [
  { cat: 'A', total: 100 }, { cat: 'B', total: 50 }, { cat: 'C', total: 30 },
  { cat: 'D', total: 15 }, { cat: 'E', total: 5 },
];
test('top3 shows 3, rest in Other', () => {
  const { shown, rest } = pickCats(rows, 'top3');
  expect(shown.map(r => r.cat)).toEqual(['A','B','C']);
  expect(rest.map(r => r.cat)).toEqual(['D','E']);
});
test('all shows everything, no rest', () => {
  const { shown, rest } = pickCats(rows, 'all');
  expect(shown).toHaveLength(5); expect(rest).toHaveLength(0);
});
test('p75 shows the smallest set covering 75% of spend', () => {
  const { shown } = pickCats(rows, 'p75'); // total 200; A+B=150=75%
  expect(shown.map(r => r.cat)).toEqual(['A','B']);
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx jest test/pickCats.test.js`

- [ ] **Step 3: Implement** — port `pickCats` + `RULE_LABEL` from `rd-views.jsx:67-79` into
`src/data/pickCats.js`, `module.exports = { pickCats, RULE_LABEL }`.

- [ ] **Step 4: Run — expect PASS.** `npx jest test/pickCats.test.js`
- [ ] **Step 5: Commit**
```bash
git add src/data/pickCats.js test/pickCats.test.js
git commit -m "feat: pickCats category selection (top-N / 75% / all)"
```

### Task 3.4: buildOverview adapter (compute model → Overview view-model)

**Files:**
- Create: `src/data/adapters.js` (start the file with `buildOverview`)
- Test: `test/adapters.overview.test.js`

- [ ] **Step 1: Failing test**

Create `test/adapters.overview.test.js`:
```js
const { buildOverview } = require('../src/data/adapters');

// minimal compute-model stand-in
const model = {
  currency: 'USD',
  postings: [
    { accounts:['Income','Salary'], amount:-1000, type:'income', date:new Date('2018-01-15T00:00:00Z') },
    { accounts:['Expenses','Food'], amount:200, type:'expenses', date:new Date('2018-01-16T00:00:00Z') },
    { accounts:['Expenses','Food'], amount:300, type:'expenses', date:new Date('2018-02-16T00:00:00Z') },
    { accounts:['Income','Salary'], amount:-1000, type:'income', date:new Date('2018-02-15T00:00:00Z') },
  ],
  intervals: ['2018-01','2018-02'],
};

test('buildOverview produces monthly bars, totals and a stat strip', () => {
  const vm = buildOverview(model);
  expect(vm.monthly).toHaveLength(2);
  expect(vm.monthly[0]).toMatchObject({ m: expect.any(String), inc: 1000, exp: 200 });
  expect(vm.statStrip.income).toBe(2000);
  expect(vm.statStrip.expenses).toBe(500);
  expect(vm.statStrip.net).toBe(1500);
  expect(vm.statStrip.savingsRate).toBe(75); // round(1500/2000*100)
  // expense categories aggregated with avg/max/min/total
  const food = vm.expenses.find(e => e.cat.endsWith('Food'));
  expect(food.total).toBe(500);
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx jest test/adapters.overview.test.js`

- [ ] **Step 3: Implement buildOverview**

Create `src/data/adapters.js` with `buildOverview(model)` that:
- buckets `model.postings` by `model.intervals` into `monthly = [{ m, inc, exp }]` (income amounts are
  negative in ledger convention → `inc += -amount` for `type==='income'`; `exp += amount` for
  `type==='expenses'`). Use a readable month label for `m` (e.g. `moment.utc(interval, 'YYYY-MM').format('MMM')`).
- aggregates expense rows by full account path → `{ cat, avg, max, min, total }` (avg over months present).
- aggregates income rows likewise → `income[]`.
- computes `statStrip = { income, expenses, net, savingsRate }`.
- returns `{ monthly, income, expenses, statStrip, categoryCount: expenses.length }`.
`module.exports = { buildOverview }`.

- [ ] **Step 4: Run — expect PASS.** `npx jest test/adapters.overview.test.js`
- [ ] **Step 5: Commit**
```bash
git add src/data/adapters.js test/adapters.overview.test.js
git commit -m "feat: buildOverview adapter (monthly bars + stat strip + category table)"
```

### Task 3.5: IncomeExpensesChart (ECharts, re-themed, purple net line)

**Files:**
- Create: `src/charts/IncomeExpensesChart.jsx`
- Test: `test/IncomeExpensesChart.test.jsx`

Re-theme ECharts to match `IEBarChart` from `rd-charts.jsx:17-94`: grouped income(green
`T.pos`)/expense(red `T.neg`) bars, a **purple `#7A47C2` net line**, a zero baseline, red-tinted
negative net area, calm tooltip. Use a `useEffect` that `echarts.init`s on a ref and sets option.

- [ ] **Step 1: Failing test (mock echarts)**

Create `test/IncomeExpensesChart.test.jsx`:
```jsx
/** @jest-environment jsdom */
import { render } from '@testing-library/react';
const setOption = jest.fn();
jest.mock('echarts', () => ({ init: () => ({ setOption, resize(){}, dispose(){} }) }));
import { IncomeExpensesChart } from '../src/charts/IncomeExpensesChart';

test('feeds income/expense/net series to echarts with the purple net color', () => {
  render(<IncomeExpensesChart monthly={[{m:'Jan',inc:1000,exp:200}]} netColor="#7A47C2" cur="USD" />);
  expect(setOption).toHaveBeenCalled();
  const opt = setOption.mock.calls[0][0];
  const json = JSON.stringify(opt);
  expect(json).toContain('#7A47C2');
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx jest test/IncomeExpensesChart.test.jsx`

- [ ] **Step 3: Implement** — `src/charts/IncomeExpensesChart.jsx`: a component taking
`{ monthly, netColor, cur, onSelectMonth }`. Build an ECharts option with two `bar` series (income
`T.pos`, expense `T.neg`) and one `line` series (net = inc−exp) coloured `netColor`, `markLine` at 0,
`areaStyle` switching to `T.neg` tint where net<0. `useRef` + `useEffect([monthly,netColor,cur])` to
`echarts.init`/`setOption`; dispose on unmount; `resize` on window resize. `export { IncomeExpensesChart }`.

- [ ] **Step 4: Run — expect PASS.** `npx jest test/IncomeExpensesChart.test.jsx`
- [ ] **Step 5: Commit**
```bash
git add src/charts/IncomeExpensesChart.jsx test/IncomeExpensesChart.test.jsx
git commit -m "feat: re-themed ECharts income/expenses chart with purple net line"
```

### Task 3.6: OverviewView + wire compute/model into Shell

**Files:**
- Create: `src/views/OverviewView.jsx`
- Modify: `src/app/Shell.jsx` (compute model via useMemo, route to OverviewView)
- Test: `test/OverviewView.test.jsx`

Port `StatStrip` + `OverviewView` from `rd-views.jsx:30-176`. Adaptations: take `vm` (from
`buildOverview`) + `cur` + `netColor` + `catRule` as props; replace mock `IE_MONTHLY`/`IE_EXPENSES`
with `vm.*`; replace the inline `IEBarChart` with `<IncomeExpensesChart .../>`; use `pickCats` from
`src/data/pickCats`; wrap all user-facing strings in `t()` (Phase 7 adds keys; use literal English now).

- [ ] **Step 1: Failing test (mock chart)**

Create `test/OverviewView.test.jsx`:
```jsx
/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
jest.mock('../src/charts/IncomeExpensesChart', () => ({ IncomeExpensesChart: () => <div data-testid="ie-chart" /> }));
import { OverviewView } from '../src/views/OverviewView';

const vm = {
  monthly: [{ m:'Jan', inc:1000, exp:200 }],
  income: [{ cat:'Income:Salary', avg:1000, max:1000, min:1000, total:1000 }],
  expenses: [ {cat:'Expenses:A',avg:1,max:1,min:1,total:600},{cat:'Expenses:B',avg:1,max:1,min:1,total:300},
              {cat:'Expenses:C',avg:1,max:1,min:1,total:60},{cat:'Expenses:D',avg:1,max:1,min:1,total:30},
              {cat:'Expenses:E',avg:1,max:1,min:1,total:10},{cat:'Expenses:F',avg:1,max:1,min:1,total:5} ],
  statStrip: { income:1000, expenses:905, net:95, savingsRate:10 }, categoryCount:6,
};

test('renders stat strip and chart', () => {
  render(<OverviewView vm={vm} cur="USD" netColor="#7A47C2" catRule="top5" />);
  expect(screen.getByTestId('ie-chart')).toBeInTheDocument();
  expect(screen.getByText(/Savings rate/i)).toBeInTheDocument();
});
test('top5 collapses the 6th category into an Other row that expands', async () => {
  render(<OverviewView vm={vm} cur="USD" netColor="#7A47C2" catRule="top5" />);
  expect(screen.getByText(/Other/)).toBeInTheDocument();
  await userEvent.click(screen.getByText(/show 1 more/i));
  expect(screen.getByText('Expenses:F')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx jest test/OverviewView.test.jsx`

- [ ] **Step 3: Implement OverviewView** per the port notes above.

- [ ] **Step 4: Wire compute + model into Shell**

In `src/app/Shell.jsx`: build `getSetting` from the settings cache (load once via
`window.api.settings.getAll()` in a `useEffect`; until loaded, use defaults from `options.js`'s
`allSettings`). Create the `typeExtractor` via `makeTypeExtractor(getSetting)`. Add:
```jsx
const model = React.useMemo(
  () => compute({ files: s.files, currency: s.currency, period: s.period,
                  deselectedAccounts: s.deselectedAccounts, dateRange: s.dateRange, typeExtractor }),
  [s.files, s.currency, s.period, s.deselectedAccounts, s.dateRange]
);
```
In `content()`, `case 'overview': return <OverviewView vm={buildOverview(model)} cur={s.currency} netColor="#7A47C2" catRule="top5" />;`
Populate the Inspector's account tree from `model.accountTree` and `currency`/`period` dropdowns from
the store. Trigger `reloadFiles()`-equivalent on mount: read `files.list` from settings and call
`window.api.parse(...)` for each (port from `files.js:39-53`/`reloadFiles`).

- [ ] **Step 5: Run OverviewView tests + full suite + build**

Run: `npx jest test/OverviewView.test.jsx` → PASS.
Run: `npm test` → green. Run: `npm run bundle` → builds.

- [ ] **Step 6: Commit**
```bash
git add src/views/OverviewView.jsx src/app/Shell.jsx test/OverviewView.test.jsx
git commit -m "feat: Overview view wired to live data via compute + buildOverview"
```

---

## Phase 4 — Expenses / Income (bar breakdown, replaces treemap)

### Task 4.1: buildBreakdownTree adapter (with explicit „not itemised" remainder)

**Files:**
- Modify: `src/data/adapters.js` (add `buildBreakdownTree`)
- Test: `test/adapters.breakdown.test.js`

This is the core functional improvement: a hierarchical tree where any parent whose children don't
sum to its own value gets an explicit `__direct` remainder row (the „Expenses:School 1000 /
:Eraser 1" problem). Mirrors the `__direct` logic in `rd-charts.jsx:163-204` but built from real postings.

- [ ] **Step 1: Failing test**

Create `test/adapters.breakdown.test.js`:
```js
const { buildBreakdownTree } = require('../src/data/adapters');

const postings = [
  { accounts:['Expenses','School'], amount:999, type:'expenses' },          // direct on parent
  { accounts:['Expenses','School','Eraser'], amount:1, type:'expenses' },    // child
  { accounts:['Expenses','Food'], amount:200, type:'expenses' },
];

test('builds a tree with totals and a not-itemised remainder', () => {
  const tree = buildBreakdownTree(postings, 'expenses');
  const school = tree.find(n => n.label === 'School');
  expect(school.value).toBe(1000);                 // 999 direct + 1 child
  const eraser = school.children.find(c => c.label === 'Eraser');
  expect(eraser.value).toBe(1);
  // remainder is represented so 999 isn't a mystery box:
  const childSum = school.children.reduce((a,c)=>a+c.value,0);
  expect(school.value - childSum).toBe(999);
});
test('income kind flips sign (income amounts are negative)', () => {
  const inc = [{ accounts:['Income','Salary'], amount:-500, type:'income' }];
  const tree = buildBreakdownTree(inc, 'income');
  expect(tree.find(n => n.label === 'Salary').value).toBe(500);
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx jest test/adapters.breakdown.test.js`

- [ ] **Step 3: Implement** `buildBreakdownTree(postings, kind)` in `src/data/adapters.js`:
filter postings to `type===kind`; for each, walk the account path **below** the root type segment
(e.g. drop the leading `Expenses`/`Income`), accumulating `value` at each node (income → `-amount`,
expense → `amount`); produce nodes `{ name, label, value, children }`. The `__direct` remainder row is
computed at render time by `BarNode` (Task 4.2) from `value − Σchildren`, so the adapter only needs
correct per-node `value` and nesting. Export it.

- [ ] **Step 4: Run — expect PASS.** `npx jest test/adapters.breakdown.test.js`
- [ ] **Step 5: Commit**
```bash
git add src/data/adapters.js test/adapters.breakdown.test.js
git commit -m "feat: buildBreakdownTree adapter with not-itemised remainder support"
```

### Task 4.2: BarBreakdown component (drill-down bars)

**Files:**
- Create: `src/charts/BarBreakdown.jsx`
- Test: `test/BarBreakdown.test.jsx`

Port `BarNode` + `BarBreakdown` from `rd-charts.jsx:163-226` verbatim (it is plain HTML/CSS, no chart
lib). Adapt: `import React, { useState }`, `import { T, money } from '../ui/tokens'`,
`import { Icon } from '../ui/Icon'`, `import { Eyebrow, Num } from '../ui/controls'`. Wrap header
labels („Category", „Share of total", „Amount", the not-itemised suffix and the hint line) in `t()`
(literal English until Phase 7).

- [ ] **Step 1: Failing test**

Create `test/BarBreakdown.test.jsx`:
```jsx
/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BarBreakdown } from '../src/charts/BarBreakdown';

const tree = [
  { name:'School', label:'School', value:1000, children:[ { name:'Eraser', label:'Eraser', value:1 } ] },
  { name:'Food', label:'Food', value:200 },
];
test('shows ranked categories and drills down to a not-itemised row', async () => {
  render(<BarBreakdown tree={tree} total={1200} cur="USD" />);
  expect(screen.getByText('School')).toBeInTheDocument();
  await userEvent.click(screen.getByText('School'));
  expect(screen.getByText('Eraser')).toBeInTheDocument();
  expect(screen.getByText(/not itemised/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx jest test/BarBreakdown.test.jsx`
- [ ] **Step 3: Implement** per port notes.
- [ ] **Step 4: Run — expect PASS.** `npx jest test/BarBreakdown.test.jsx`
- [ ] **Step 5: Commit**
```bash
git add src/charts/BarBreakdown.jsx test/BarBreakdown.test.jsx
git commit -m "feat: BarBreakdown drill-down component (replaces treemap)"
```

### Task 4.3: ExpensesIncomeView (Visual/Text toggle + percentages) + wire into Shell

**Files:**
- Create: `src/views/ExpensesIncomeView.jsx`
- Modify: `src/app/Shell.jsx` (routes `expenses`/`income` → this view)
- Test: `test/ExpensesIncomeView.test.jsx`

Port `TreemapView` from `rd-views2.jsx:45-84` → rename `ExpensesIncomeView`. Props: `{ tree, total,
cur, kind }`. „Visual" tab renders `<BarBreakdown>`; „Text" tab renders the percentage table
(`rd-views2.jsx:63-80`). Use `Segmented` with labels „Visual"/„Text" (NOT „Graph").

- [ ] **Step 1: Failing test**

Create `test/ExpensesIncomeView.test.jsx`:
```jsx
/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpensesIncomeView } from '../src/views/ExpensesIncomeView';

const tree = [ { name:'Food', label:'Food', value:300 }, { name:'Rent', label:'Rent', value:700 } ];
test('defaults to Visual, switches to Text with percentages', async () => {
  render(<ExpensesIncomeView tree={tree} total={1000} cur="USD" kind="expense" />);
  expect(screen.getByText('Visual')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Text'));
  expect(screen.getByText('70%')).toBeInTheDocument(); // Rent 700/1000
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx jest test/ExpensesIncomeView.test.jsx`
- [ ] **Step 3: Implement** + in Shell `content()`:
```jsx
case 'expenses': { const tree = buildBreakdownTree(model.postings, 'expenses');
  return <ExpensesIncomeView tree={tree} total={tree.reduce((a,n)=>a+n.value,0)} cur={s.currency} kind="expense" />; }
case 'income': { const tree = buildBreakdownTree(model.postings, 'income');
  return <ExpensesIncomeView tree={tree} total={tree.reduce((a,n)=>a+n.value,0)} cur={s.currency} kind="income" />; }
```
- [ ] **Step 4: Run tests + build.** `npx jest test/ExpensesIncomeView.test.jsx`; `npm test`; `npm run bundle`.
- [ ] **Step 5: Commit**
```bash
git add src/views/ExpensesIncomeView.jsx src/app/Shell.jsx test/ExpensesIncomeView.test.jsx
git commit -m "feat: Expenses/Income view with Visual/Text toggle and percentages"
```

---

## Phase 5 — Balance, Assets, Portfolio

### Task 5.1: buildBalanceTree adapter + BalanceView

**Files:**
- Modify: `src/data/adapters.js` (add `buildBalanceTree`)
- Create: `src/views/BalanceView.jsx`
- Test: `test/adapters.balance.test.js`, `test/BalanceView.test.jsx`

- [ ] **Step 1: Failing adapter test**

Create `test/adapters.balance.test.js`:
```js
const { buildBalanceTree } = require('../src/data/adapters');
// balances: Map<{account,type}, number[]> as compute() returns; use the last interval index.
test('builds a nested account tree with net worth', () => {
  const balances = new Map([
    [{ account:'Assets:Bank', type:'assets' }, [1000]],
    [{ account:'Expenses:Food', type:'expenses' }, [200]],
    [{ account:'Income:Salary', type:'income' }, [-1200]],
  ]);
  const { roots, netWorth } = buildBalanceTree(balances, 0);
  const assets = roots.find(r => r.account === 'Assets');
  expect(assets.balance).toBe(1000);
  expect(assets.children[0].account).toBe('Assets:Bank');
  expect(typeof netWorth).toBe('number');
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx jest test/adapters.balance.test.js`
- [ ] **Step 3: Implement** `buildBalanceTree(balances, intervalIdx)`: group the Map entries by
top-level account segment, sum values at `intervalIdx`, nest by `:`-split path, compute `netWorth`
(assets − liabilities, or per existing balance.js convention — check `balance.js` for the exact
net-worth rule and reuse it). Mirror the node shape `BalRow` expects (`rd-views.jsx:208-228`):
`{ id, account, balance, type, children }`.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Component test** — create `test/BalanceView.test.jsx` (render tree, assert a parent
row and that clicking expands children). Port `BalRow`+`BalanceView` from `rd-views.jsx:178-249`,
props `{ roots, netWorth, cur }`.
- [ ] **Step 6: Wire Shell** `case 'balance': return <BalanceView {...buildBalanceTree(model.balances, model.sliderValues[1])} cur={s.currency} />;`
- [ ] **Step 7: Run tests + build, commit**
```bash
git add src/data/adapters.js src/views/BalanceView.jsx test/adapters.balance.test.js test/BalanceView.test.jsx src/app/Shell.jsx
git commit -m "feat: Balance view (tree table + net worth) on live balances"
```

### Task 5.2: AreaLineChart (ECharts) + buildAssets adapter + AssetsView

**Files:**
- Create: `src/charts/AreaLineChart.jsx`, `src/views/AssetsView.jsx`
- Modify: `src/data/adapters.js` (add `buildAssets`)
- Test: `test/adapters.assets.test.js`, `test/AssetsView.test.jsx`

- [ ] **Step 1: Failing adapter test** — `buildAssets(model)` turns per-account asset/liability
balance series into `{ data:[{m, <key>:value,…}], series:[{key,color,label}], maxY, grid }`
(shape consumed by `AreaLineChart`, cf. `rd-views2.jsx:95-114`). Assert series count and that
`data` length equals interval count.
- [ ] **Step 2: Run — FAIL. Step 3: Implement.** Pull asset/liability accounts from `model.balances`
(type asset/liability), one series per top-level account, colour from `T.chart`.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: AreaLineChart** — port `AreaLineChart` from `rd-charts.jsx:99-155` as an ECharts
re-theme (stacked/overlaid area lines + crosshair tooltip). Test with mocked `echarts` (assert
`setOption` called with the series keys).
- [ ] **Step 6: AssetsView** — port `AssetsView` from `rd-views2.jsx:95-126`, props `{ vm, cur }`,
summary strip + `<AreaLineChart>` + legend. Wire Shell `case 'assets'`.
- [ ] **Step 7: Run tests + build, commit**
```bash
git add src/charts/AreaLineChart.jsx src/views/AssetsView.jsx src/data/adapters.js test/adapters.assets.test.js test/AssetsView.test.jsx src/app/Shell.jsx
git commit -m "feat: Assets & Liabilities view with re-themed area-line chart"
```

### Task 5.3: buildPortfolio adapter + PortfolioView

**Files:**
- Create: `src/views/PortfolioView.jsx`
- Modify: `src/data/adapters.js` (add `buildPortfolio`)
- Test: `test/adapters.portfolio.test.js`, `test/PortfolioView.test.jsx`

- [ ] **Step 1: Failing adapter test** — `buildPortfolio(model)` uses `model.valResult` +
`ValuationService` (already in compute) to produce `{ totals:[{m,value}], holdings:[{account,asset,
qty,cost,market,gain}], totalCost, totalMarket, totalGain }`. Reuse the existing portfolio math from
`portfolio.js` (read it; extract the pure calculation into the adapter, keep numbers identical).
Assert `totalGain === totalMarket − totalCost` and holdings shape.
- [ ] **Step 2: FAIL → Step 3 implement → Step 4 PASS.**
- [ ] **Step 5: PortfolioView** — port `PortfolioView` from `rd-views2.jsx:134-183`: summary strip
(cost basis / market value / unrealised gain), `<AreaLineChart>` of total value, holdings table with
`(+x.x%)`. Props `{ vm, cur }`. Component test asserts a holding row + the unrealised % renders.
- [ ] **Step 6: Wire Shell `case 'portfolio'`. Run tests + build. Commit.**
```bash
git add src/views/PortfolioView.jsx src/data/adapters.js test/adapters.portfolio.test.js test/PortfolioView.test.jsx src/app/Shell.jsx
git commit -m "feat: Portfolio view (holdings + unrealised gain) on live valuation"
```

---

## Phase 6 — Postings + search, Options form, Print, App icon

### Task 6.1: postingsFilter (search + type) with sorting

**Files:**
- Create: `src/data/postingsFilter.js`
- Test: `test/postingsFilter.test.js`

- [ ] **Step 1: Failing test**

Create `test/postingsFilter.test.js`:
```js
const { filterPostings, sortPostings } = require('../src/data/postingsFilter');
const rows = [
  { date:'2018-12-25', payee:'Rent Co', account:'Expenses:Rent', amount:700, type:'expense' },
  { date:'2018-12-26', payee:'Acme', account:'Income:Salary', amount:-1000, type:'income' },
  { date:'2018-12-24', payee:'Shop', account:'Expenses:Food', amount:50, type:'expense' },
];
test('search matches payee, account, or date (case-insensitive)', () => {
  expect(filterPostings(rows, 'rent', 'all').map(r=>r.payee)).toEqual(['Rent Co']);
  expect(filterPostings(rows, 'salary', 'all')).toHaveLength(1);
  expect(filterPostings(rows, '2018-12-24', 'all')).toHaveLength(1);
});
test('type filter narrows by type', () => {
  expect(filterPostings(rows, '', 'income')).toHaveLength(1);
});
test('sortPostings by date descending', () => {
  const out = sortPostings(rows, 'date', 'desc');
  expect(out.map(r=>r.date)).toEqual(['2018-12-26','2018-12-25','2018-12-24']);
});
```

- [ ] **Step 2: Run — FAIL.** `npx jest test/postingsFilter.test.js`
- [ ] **Step 3: Implement** `filterPostings(rows, query, typeFilter)` (port the predicate from
`rd-views.jsx:285-290`) and `sortPostings(rows, key, dir)` (stable comparator over date/payee/account/
amount). Export both.
- [ ] **Step 4: PASS. Step 5: Commit**
```bash
git add src/data/postingsFilter.js test/postingsFilter.test.js
git commit -m "feat: postings search/type filter + column sort"
```

### Task 6.2: buildPostings adapter + PostingsView (sortable, searchable)

**Files:**
- Modify: `src/data/adapters.js` (add `buildPostings`)
- Create: `src/views/PostingsView.jsx`
- Modify: `src/app/Shell.jsx`
- Test: `test/PostingsView.test.jsx`

- [ ] **Step 1: Failing component test**

Create `test/PostingsView.test.jsx`:
```jsx
/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostingsView } from '../src/views/PostingsView';
const rows = [
  { date:'2018-12-25', payee:'Rent Co', account:'Expenses:Rent', amount:700, type:'expense' },
  { date:'2018-12-26', payee:'Acme', account:'Income:Salary', amount:-1000, type:'income' },
];
test('filters by query prop', () => {
  render(<PostingsView rows={rows} query="rent" typeFilter="all" cur="USD" />);
  expect(screen.getByText('Rent Co')).toBeInTheDocument();
  expect(screen.queryByText('Acme')).not.toBeInTheDocument();
});
test('clicking a column header re-sorts', async () => {
  render(<PostingsView rows={rows} query="" typeFilter="all" cur="USD" />);
  await userEvent.click(screen.getByText(/Payee/i));
  const cells = screen.getAllByText(/Rent Co|Acme/);
  expect(cells[0]).toHaveTextContent('Acme'); // ascending by payee
});
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** `buildPostings(model)` → `[{date,payee,account,amount,type}]` (map
`model.postings`: `payee` from `merchant`, `account` from `accounts.join(':')`, `date` from
`dateString`/ISO). Port `PostingsView` from `rd-views.jsx:251-321` adding clickable `<th>` sort
(local `useState` for `sortKey`/`sortDir`, apply `sortPostings`), and apply `filterPostings(rows,
query, typeFilter)`. Badge map from `POST_BADGE`.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Wire Shell** `case 'postings': return <PostingsView rows={buildPostings(model)} query={s.query} typeFilter={s.postingType} cur={s.currency} />;`
The header type-`Segmented` (already in Shell from Phase 2) drives `s.postingType`; the toolbar search
drives `s.query` (already routes here from Phase 2).
- [ ] **Step 6: Run tests + build. Commit.**
```bash
git add src/data/adapters.js src/views/PostingsView.jsx src/app/Shell.jsx test/PostingsView.test.jsx
git commit -m "feat: Postings view with live search, type filter, and sortable columns"
```

### Task 6.3: New setting options.overview.catRule (persisted)

**Files:**
- Modify: `main.js:284-295` (knownKeys), `options.js` (allSettings), Shell (read catRule)
- Test: `test/options.test.js` (extend), `test/catRule-known-key.test.js`

- [ ] **Step 1: Failing test** — create `test/catRule-known-key.test.js` asserting `'options.overview.catRule'`
is in the `knownKeys` list. Simplest: export the list. Refactor `main.js` to
`const KNOWN_KEYS = [...]; module.exports = { KNOWN_KEYS };` (guard: `main.js` is the electron entry;
exporting a const is harmless). Then:
```js
const { KNOWN_KEYS } = require('../main');
test('catRule is a known persisted key', () => {
  expect(KNOWN_KEYS).toContain('options.overview.catRule');
});
```
> If requiring `main.js` in jest triggers electron side-effects, instead extract the list to a new
> `knownKeys.js` module required by both `main.js` and the test. Prefer that.

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** — add `'options.overview.catRule'` to the list; add a `Setting` to
`options.js` `allSettings` (type DROPDOWN, default `'top5'`, options `top3/top5/top8/p75/all`,
`onChange` re-renders). Shell reads it via `getSetting('options.overview.catRule')` and passes to
`OverviewView` (replacing the hardcoded `'top5'`).
- [ ] **Step 4: PASS + full suite.**
- [ ] **Step 5: Commit**
```bash
git add main.js knownKeys.js options.js src/app/Shell.jsx test/catRule-known-key.test.js
git commit -m "feat: persist options.overview.catRule (Top-N rule) setting"
```

### Task 6.4: OptionsView (GroupCard form) wired to settings

**Files:**
- Create: `src/views/OptionsView.jsx`
- Modify: `src/app/Shell.jsx`
- Test: `test/OptionsView.test.jsx`

Port `OptionsView` + `Row`/`GroupCard`/`Toggle`/`inputStyle` from `rd-views2.jsx:185-251`. Wire each
control to `getSetting`/`window.api.settings.set` (read on mount, write on change). Include: ledger
path (+Browse), hledger toggle, the 5 account regexes (+Use default), language dropdown
(`getAvailableLocales`), and the new **Category table (Top-N)** dropdown. Language change must call
`window.api.menu.rebuild()` (cf. `options.js:119-132`).

- [ ] **Step 1: Failing test** — create `test/OptionsView.test.jsx`: mock `window.api.settings`,
render, toggle hledger, assert `settings.set('options.hledger', true)` called.
- [ ] **Step 2: FAIL → Step 3 implement → Step 4 PASS.**
- [ ] **Step 5: Wire Shell `case 'options'`. Build. Commit.**
```bash
git add src/views/OptionsView.jsx src/app/Shell.jsx test/OptionsView.test.jsx
git commit -m "feat: Options form (GroupCard style) wired to persisted settings"
```

### Task 6.5: Printing (File ▸ Print, ⌘P/Ctrl+P, print header + CSS)

**Files:**
- Modify: `src/app/Shell.jsx` (print handler, ⌘P listener, `#printHeader`, chrome-print-hide classes)
- Modify: `index.html` (`@media print` rules — already moved in Task 2.3; verify they target the
  new class names `chrome-print-hide`, `print-card`, `pane-content`)
- Test: `test/Shell.print.test.jsx`

- [ ] **Step 1: Failing test**

Create `test/Shell.print.test.jsx`:
```jsx
/** @jest-environment jsdom */
import { render } from '@testing-library/react';
import { Shell } from '../src/app/Shell';
beforeEach(() => { window.api = { onParsed(){}, settings:{getAll:async()=>({}),get:async()=>[],set(){}},
  windowControls:{minimize(){},maximize(){},close(){}}, platform:'darwin' }; window.print = jest.fn(); });
test('Cmd+P triggers window.print', () => {
  render(<Shell />);
  const e = new KeyboardEvent('keydown', { key:'p', metaKey:true });
  window.dispatchEvent(e);
  expect(window.print).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run — FAIL** (no listener yet).
- [ ] **Step 3: Implement** — port the print effect from `rd-shell.jsx:277-282` (⌘P/Ctrl+P →
`window.print()`), the `FileMenu` Print items already call `onPrint`. Ensure the `#printHeader`
(`rd-shell.jsx:376-380`) renders title/file/period/currency/date, and that chrome wrappers carry
`className="chrome-print-hide"` and the card/pane carry `print-card`/`pane-content` so the existing
`@media print` block hides chrome and lets the active report flow. Cross-check against the original
`print.js` header content for parity.
- [ ] **Step 4: Run test + manual: `npm start`, ⌘P shows only the active report.**
- [ ] **Step 5: Commit**
```bash
git add src/app/Shell.jsx index.html test/Shell.print.test.jsx
git commit -m "feat: printing via File menu and Cmd/Ctrl+P with chrome-hiding print CSS"
```

### Task 6.6: Gerbil app icon

**Files:**
- Modify: `package.json` (`build.mac.icon`, add `build.win`, `build.linux`)
- Modify: `main.js` (BrowserWindow `icon` for win/linux runtime)
- Create: `icons/gerbil.icns`, `icons/gerbil.ico`

- [ ] **Step 1: Generate platform icons from `icons/gerbil.png`**

Run (macOS has `iconutil`; for `.ico` use ImageMagick or `png-to-ico`):
```bash
# .icns
mkdir -p /tmp/gerbil.iconset
for s in 16 32 128 256 512; do
  sips -z $s $s icons/gerbil.png --out /tmp/gerbil.iconset/icon_${s}x${s}.png
  sips -z $((s*2)) $((s*2)) icons/gerbil.png --out /tmp/gerbil.iconset/icon_${s}x${s}@2x.png
done
iconutil -c icns /tmp/gerbil.iconset -o icons/gerbil.icns
# .ico
npx --yes png-to-ico icons/gerbil.png > icons/gerbil.ico
```
Expected: `icons/gerbil.icns` and `icons/gerbil.ico` exist.

- [ ] **Step 2: Point electron-builder + runtime window at the gerbil**

In `package.json` `build`: set `"mac": { "icon": "icons/gerbil.icns", ... }`, add
`"win": { "icon": "icons/gerbil.ico", "target": ["zip", "nsis"] }`,
`"linux": { "icon": "icons/gerbil.png" }`. In `main.js` `windowOptionsFor`/createWindow, for win/linux
pass `icon: path.join(__dirname, 'icons', process.platform === 'win32' ? 'gerbil.ico' : 'gerbil.png')`.
Ensure `icons/**` is already in `build.files` (it is).

- [ ] **Step 3: Verify packaging metadata** — Run `npx jest` (green) and `npm run bundle`. Full
`npm run dist` is optional/heavy; at minimum confirm `electron-builder` config validates by running
`npx electron-builder --help` exits 0 (no config parse needed) — packaging itself can be a manual step.

- [ ] **Step 4: Commit**
```bash
git add package.json main.js icons/gerbil.icns icons/gerbil.ico
git commit -m "feat: use gerbil as app icon (mac .icns, win .ico, linux png)"
```

---

## Phase 7 — i18n sweep + cleanup

### Task 7.1: Add all new UI strings to every locale

**Files:**
- Modify: all 12 `locales/*.json`
- Modify: every `src/views/*.jsx`, `src/app/Shell.jsx`, `src/charts/BarBreakdown.jsx` (replace literal
  English with `t('key')`)
- Test: `test/i18n-redesign-keys.test.js`

- [ ] **Step 1: Failing test — every locale has the new keys**

Create `test/i18n-redesign-keys.test.js`:
```js
const fs = require('fs');
const path = require('path');
const NEW_KEYS = [
  'stat.income','stat.expenses','stat.net_saved','stat.savings_rate',
  'overview.largest_categories','overview.show_more','overview.collapse','overview.other',
  'toggle.visual','toggle.text','breakdown.category','breakdown.share_of_total','breakdown.amount',
  'breakdown.not_itemised','breakdown.hint',
  'filter.date_range','filter.accounts','filter.all','filter.none','filter.showing_x_of_y','filter.filters',
  'nav.reports','nav.ledger','search.placeholder',
  'menu.file','menu.edit','menu.view','menu.window','menu.help',
  'file.open','file.reload','file.reveal','file.remove','file.print','file.print_pdf','file.open_ledger',
  'portfolio.cost_basis','portfolio.market_value','portfolio.unrealised_gain','assets.total_assets',
  'settings.category_table','settings.category_table.help',
];
const dir = path.join(__dirname, '..', 'locales');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  test(`${f} has all redesign keys`, () => {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    for (const k of NEW_KEYS) expect(j[k]).toBeDefined();
  });
}
```

- [ ] **Step 2: Run — FAIL** (keys missing).
- [ ] **Step 3: Add keys** — add English values to `locales/en.json` first, then translate into the
other 11 (`de, es, fr, it, ja, ko, nl, pl, pt, ru, zh-CN`). Use `update_translations.js` to sync key
order/presence. Replace the literal English in components with `t('key')` (import `t` from `../../i18n`
relative to `src/...` — i.e. `require('../../i18n')` or an `import { t } from '../../i18n'` shim).
Follow the terse, sentence-case tone from the design README.
- [ ] **Step 4: Run — PASS (12 locale tests) + full suite + build.**
- [ ] **Step 5: Commit**
```bash
git add locales/ src/ test/i18n-redesign-keys.test.js
git commit -m "i18n: add all Quiet Ledger strings across 12 locales"
```

### Task 7.2: Remove the dead jQuery/Bootstrap renderer

**Files:**
- Delete: `ui.js`, `treeMap.js`, `treeTable.js`, `balance.js`, `assets.js`, `portfolio.js`,
  `incomeExpenses.js`, `postings.js`, `toggle.js`, `tabVisibility.js`, `dateRangeSelector.js`,
  `currency.js`, `print.js`, `accountFilter.js` (render half — keep `buildAccountTree`/`filterPostings`
  if `compute.js` imports them; if so, move those pure fns into `src/data/` and delete the rest).
- Modify: `package.json` devDependencies (remove jQuery/Bootstrap/DataTables/jquery-treetable/jquery-ui/
  streamjs/popper.js), `build.files` (drop `vendor/**` if unused now).
- Delete: `vendor/` (only if nothing references it after the cleanup).

- [ ] **Step 1: Find references before deleting**

Run: `grep -rEl "require\\('\\./(ui|treeMap|treeTable|balance|assets|portfolio|incomeExpenses|postings|toggle|tabVisibility|dateRangeSelector|currency|print|accountFilter)'" --include=*.js .`
Expected: only test files + the modules themselves. Resolve any live import by moving the needed pure
function into `src/data/`.

- [ ] **Step 2: Preserve still-needed pure logic**

If `compute.js` uses `buildAccountTree`/`filterPostings` from `accountFilter.js`, move those functions
to `src/data/accountTree.js` (with their tests from `test/accountFilter.test.js`) and update imports.
Keep those tests green.

- [ ] **Step 3: Delete dead files + their obsolete tests**

Delete the renderer modules above and the tests that only exercised the old DOM (`test/treeMap.test.js`,
`test/tabVisibility.test.js`, `test/print.test.js`, `test/portfolio.test.js` if it tested the old
chart). Keep `valuation`, `hledger`, `i18n`, `menu`, `options` (adjusted), `accountTree` tests.

- [ ] **Step 4: Prune deps + run full suite + build**

Run: `npm uninstall jquery bootstrap popper.js streamjs datatables.net-dt datatables.net-buttons-dt datatables.net-colreorder-dt datatables.net-fixedheader-dt datatables.net-responsive-dt datatables.net-scroller-dt` and remove `jquery-treetable`/`jquery-ui` vendor refs.
Run: `npm test` → green. Run: `npm run bundle` → builds. Run: `npm start` → app opens, all views work.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "refactor: remove dead jQuery/Bootstrap/DataTables renderer and vendor deps"
```

### Task 7.3: Final polish pass

- [ ] **Step 1:** `npm start` and walk every view on macOS chrome: nav, currency/period/filters,
  search→postings, drill-down, Top-N toggle, negative-net month, print (⌘P), options round-trip,
  journal footer menu. Fix visual deltas against the mockup screenshots in
  `Entwicklung/redesign/project/assets/screenshots/`.
- [ ] **Step 2:** Temporarily force Windows chrome (set `windowOptionsFor` to `'win32'` path or run on
  Windows) and verify custom controls + in-window menu render and the controls work.
- [ ] **Step 3:** `npm test` green; commit any fixes.
```bash
git add -A
git commit -m "polish: align redesign with mockup across all views and both platforms"
```

---

## Self-Review (completed by plan author)

**Spec coverage:** Source-list nav ✓(2.3) · platform chrome ✓(2.1,2.3) · inspector/filters/period/
currency ✓(2.3,3.6) · stat strip + Top-N + purple net + negative net ✓(3.4,3.5,3.6) · breakdown +
not-itemised + Visual/Text + % ✓(4.1–4.3) · balance/assets/portfolio ✓(5.1–5.3) · search→postings +
sort ✓(2.2,6.1,6.2) · catRule setting + knownKeys ✓(6.3) · options form ✓(6.4) · print ✓(6.5) ·
gerbil icon ✓(6.6) · i18n 12 locales ✓(7.1) · ECharts re-theme ✓(3.5,5.2) · keep formatters — note:
`compute`/adapters return raw numbers; `money()`/existing formatter applied in components (formatters
retained until a component needs locale-currency, then use `state.formatter` equivalent) · DataTables
removed + sort rebuilt ✓(6.1,6.2,7.2).

**Placeholder scan:** No „TBD"/„handle edge cases" steps; component ports name exact source files +
adaptations; new logic has full code + tests.

**Type consistency:** `compute()` returns `{currency,currencies,postings,rawPostings,intervals,
intervalDates,balances,valResult,accountTree,sliderValues}` — used consistently by `buildOverview`/
`buildBreakdownTree`/`buildBalanceTree`/`buildAssets`/`buildPortfolio`/`buildPostings`. `pickCats`
returns `{shown,rest}` (3.3 ↔ used in 3.6). `useAppState` field names (`view`,`query`,`currency`,
`period`,`postingType`,`deselectedAccounts`,`inspectorOpen`) consistent across 2.2/2.3/3.6/6.2.

**Open implementation note for executor:** `compute.js` (Task 3.2) is the riskiest port — budget extra
care and lean on the existing `test/valuation.test.js` data shapes. If the period date-formatter lives
in `dateRangeSelector.js`, copy it into `compute.js` before deleting that file in 7.2.
