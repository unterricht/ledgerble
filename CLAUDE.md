# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Ledgerble is an Electron desktop GUI for [ledger-cli](https://www.ledger-cli.org/)
(and optionally `hledger`). It shells out to the user's `ledger`/`hledger`
binary, parses its CSV/prices output, and renders interactive charts and tables
(income/expenses, balance, assets, portfolio valuation, postings). It does not
implement plain-text accounting itself — it visualises what the CLI produces.

## Commands

```bash
npm start            # bundle the renderer (esbuild) + launch electron
npm run bundle       # esbuild src/app/index.jsx -> dist/bundle.js (run before electron if not using `start`)
npm test             # jest (all tests in test/)
npm run dist         # bundle + electron-builder, mac arm64 dmg
npx jest test/valuation.test.js              # run one test file
npx jest -t "detectBaseCurrency"             # run tests matching a name
```

There is **no lint or typecheck step** — the codebase is plain CommonJS
JavaScript (not TypeScript), so the global TypeScript/ESLint guidance in
`~/.claude/CLAUDE.md` does not apply here. Match the existing CommonJS style
(`require`/`module.exports`), not ES modules.

`dist.sh` is a legacy electron-packager script (win/mac x64); the supported
packaging path is `npm run dist` via electron-builder.

## Architecture

### Two processes, one bridge

This is a security-hardened Electron app: `nodeIntegration: false`,
`contextIsolation: true`. The renderer has **no direct Node/Electron access**.

- **Main process** (`main.js`): owns all Node capabilities — spawning the
  ledger CLI, parsing its output, `settings-store` persistence, native menu
  (`menu.js`), i18n locale loading. Communicates only via IPC.
- **Preload** (`preload.js`): the *only* bridge. Exposes a narrow `window.api`
  (parse, onParsed, settings get/set/getAll, showOpenDialog, showOpenJournal,
  revealFile, getIncludes, menu.rebuild, pathBasename, webUtils.getPathForFile,
  platform, windowControls). When the renderer needs a new main-process
  capability, add it here AND add the matching `ipcMain` handler in `main.js`.
- **Renderer** — a **React app** under `src/` (entry `src/app/index.jsx`,
  bundled by esbuild into `dist/bundle.js`, loaded by `index.html`). Uses
  `window.api` exclusively. The old jQuery renderer (`ui.js`, `files.js`,
  `treeMap.js`, `balance.js`, `assets.js`, `portfolio.js`, …) and the
  jQuery/Bootstrap/DataTables stack are **legacy dead code**, no longer in the
  bundle — do not edit them expecting changes to show up.

`index.html` loads `dist/bundle.js`, so **renderer code changes require a
re-bundle** (`npm run bundle`, or just use `npm start`). Editing `src/` and
re-running electron without bundling will appear to do nothing.

### Data flow

1. The renderer calls `window.api.parse(command, hledger, file)` (on mount for
   each persisted `files.list` entry, or when the user opens a file via the
   journal footer in `src/app/Shell.jsx`).
2. Main process (`main.js`) runs the CLI. For ledger it runs three commands in
   parallel: `csv` (market amounts), `csv -B` (cost basis), and `prices`. For
   hledger it runs `register -O csv`. Output is parsed with `papaparse` into
   `{ postings, postingsCost, prices }`.
3. Result returns via the `parsed` IPC event → `window.api.onParsed`, subscribed
   once in `src/store/useAppState.js`.
4. `useAppState` stores each file's result in `files` (a React-state `Map`).
   Changing that Map (or any other state) re-renders `Shell`, which recomputes
   the view model.

### `compute()` + the views are the heart of the renderer

`src/app/Shell.jsx` is the root component. On every relevant state change it runs
`compute()` (`src/data/compute.js`, memoized over files/currency/period/
deselected accounts/date range/typeExtractor), which:

- merges postings across all files,
- runs `ValuationService` to compute running balances / market value,
- builds time intervals (daily buckets) and per-account balance series,
- substitutes market value for non-base-currency holdings.

The resulting model is shaped per-tab by the `build*` adapters in
`src/data/adapters.js` (`buildOverview`, `buildBalanceTree`, `buildAssets`,
`buildPortfolio`, `buildPostings`, …) and rendered by the view components in
`src/views/` (+ chart components in `src/charts/`, which wrap ECharts).
Shared renderer state lives in `useAppState`; pass it down via props/React
context rather than the old `window.*` globals.

### Account classification is regex-driven

There is no fixed chart of accounts. `makeTypeExtractor`
(`src/data/typeExtractor.js`) classifies each account string as
income/expenses/assets/liabilities/equity by matching it against
user-configurable regexes (defaults in `options.js`, e.g. `^expenses?(:|$)`).
Changing classification = changing these settings, not hardcoding account names.

### Valuation (valuation.js)

`ValuationService` handles multi-currency / commodity portfolios: it tracks
running quantity + cost basis per account/commodity, looks up historical prices
(walking backwards up to ~10 years to find the nearest prior price), converts
between currencies (direct or inverse rate), and computes market value and
unrealized gain. `detectBaseCurrency` picks the most frequent commodity;
`detectBaseCurrencies` collects all plausible display currencies for the
currency dropdown. This is the most logic-dense, most-tested module — prefer
extending it test-first.

### Settings

Persisted via `settings-store` in the **main process**. The renderer loads the
whole cache once on mount (`window.api.settings.getAll()` in `Shell.jsx`) into
React state; `makeGetSetting(cache)` reads it and `setSetting(key, value)`
updates React state AND calls `window.api.settings.set`. `getAll` is gated by
the hardcoded key list in **`knownKeys.js`** (`KNOWN_KEYS`, consumed by
`main.js`) — **adding a new persisted setting means adding its key there too**,
or it won't survive a restart.

### i18n

`i18n.js` works in both processes (no fs/path — locales are `require`d so
esbuild inlines them). Locale JSON lives in `locales/` (12 languages). In the
React renderer, translate by calling `t('key')` inline (the old attribute-driven
`data-i18n` / `translatePage()` path belongs to the legacy jQuery renderer).
When adding UI text, add a key to **all** `locales/*.json` and reference it via
`t('key')`, never hardcode user-facing strings. `update_translations.js` helps
sync keys across locale files.

## Testing notes

- Jest, default node environment. Pure-logic modules (`valuation.js`,
  `hledger.js`, `i18n.js`, `includes.js`, `src/data/*`) are tested directly.
  React components are tested with `@testing-library/react` in `*.test.jsx`
  files that opt into jsdom via the `/** @jest-environment jsdom */` docblock
  (see `test/Shell.test.jsx`); ECharts is stubbed (`jest.mock('echarts', …)`).
- Per the global standard in `~/.claude/CLAUDE.md`, new features/bugfixes follow
  Red/Green TDD and the suite must pass (or remaining failures be explicitly
  classified) before a task is considered done.

## Gotchas

- **Dates are handled as UTC `YYYY-MM-DD`** to dodge timezone drift. `main.js`
  formats with `moment.utc(...)`; the renderer reconstructs
  `new Date(str + 'T00:00:00Z')`. Keep new date code in UTC.
- **`csv` vs `csv -B` line-count mismatch**: ledger sometimes emits a different
  number of rows for market vs cost output. `valuation.js` detects this and
  falls back to `date|account` map-based matching instead of positional pairing.
- **Include de-duplication:** a journal can `include` other files, so loading
  both a parent and one of its includes would double-count postings. `main.js`
  resolves each loaded file's include tree (`journal:includes` → `includes.js`
  `collectIncludes`, using `fs`), and `Shell.jsx` drops files already pulled in
  elsewhere before calling `compute()` (`findRedundantFiles`). The path-free
  redundancy helpers live in `src/data/redundancy.js` (NOT `includes.js`) so the
  browser bundle never tries to bundle Node's `path` — keep renderer-imported
  logic free of Node built-ins.
- Loose root-level `test-*.js` / `test-*.ledger` files and the `Entwicklung/`
  folder are ad-hoc scratch/experiment files, not part of the Jest suite.
- The renderer is React 18 + ECharts (charts only). It is **not** the legacy
  jQuery/Bootstrap/DataTables stack — those root-level `*.js` modules are dead
  code kept around but not bundled.
