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
npm run bundle       # esbuild ui.js -> dist/bundle.js (run before electron if not using `start`)
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
  (parse, onParsed, settings get/set/getAll, menu.rebuild, path utils,
  webUtils.getPathForFile). When the renderer needs a new main-process
  capability, add it here AND add the matching `ipcMain` handler in `main.js`.
- **Renderer** (`ui.js` + the other `*.js` modules): bundled by esbuild into
  `dist/bundle.js`, loaded by `index.html`. Uses `window.api` exclusively.

`index.html` loads `dist/bundle.js`, so **renderer code changes require a
re-bundle** (`npm run bundle`, or just use `npm start`). Editing `ui.js` and
re-running electron without bundling will appear to do nothing.

### Data flow

1. User picks a file (`files.js`) → `window.api.parse(command, hledger, file)`.
2. Main process (`main.js`) runs the CLI. For ledger it runs three commands in
   parallel: `csv` (market amounts), `csv -B` (cost basis), and `prices`. For
   hledger it runs `register -O csv`. Output is parsed with `papaparse` into
   `{ postings, postingsCost, prices }`.
3. Result returns via the `parsed` IPC event → `window.api.onParsed` in `ui.js`.
4. `ui.js` stores each file's result in `state.files` (a `Map`), then calls the
   central `update()` function.

### The `update()` function (ui.js) is the heart of the renderer

`update()` is the single re-render entry point — almost every interaction
(file change, currency change, date-slider change, account filter toggle, tab
switch) ends by calling the global `window.update()`. It:

- merges postings across all files,
- runs `ValuationService` to compute running balances / market value,
- builds time intervals (daily buckets) and per-account balance series,
- substitutes market value for non-base-currency holdings,
- then feeds each tab's renderer: `treeMap.js` (expenses/income), `balance.js`,
  `assets.js`, `portfolio.js`, `incomeExpenses.js`, `postings.js`.

Renderer modules share state through a few **globals set by `ui.js`**:
`window.state`, `window.update`, `window.escapeHtml`, `window.showModal`,
`window.i18nTranslatePage`. This is intentional (modules are `require`d but
coordinate via these), so when adding a module that other modules call, follow
the same pattern rather than threading params everywhere.

### Account classification is regex-driven

There is no fixed chart of accounts. `ui.js`'s `typeExtractor` classifies each
account string as income/expenses/assets/liabilities/equity by matching it
against user-configurable regexes (defaults in `options.js`, e.g.
`^expenses?(:|$)`). Changing classification = changing these settings, not
hardcoding account names.

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

Persisted via `settings-store` in the **main process**. The renderer reads them
through a synchronous cache: `options.js` calls `loadSettingsCache()` once at
startup (`window.api.settings.getAll()`), then `getSetting(key)` reads the
cache. Writes go through `window.api.settings.set` AND update the cache.
`main.js` has a hardcoded `knownKeys` list for `getAll` — **adding a new
persisted setting means adding its key there too**, or it won't survive a
restart.

### i18n

`i18n.js` works in both processes (no fs/path — locales are `require`d so
esbuild inlines them). Locale JSON lives in `locales/` (12 languages). DOM
translation is attribute-driven: elements with `data-i18n` /
`data-i18n-html` / `data-i18n-placeholder` are filled by `translatePage()`.
When adding UI text, add a key to **all** `locales/*.json` and reference it via
`data-i18n` (HTML) or `t('key')` (JS), never hardcode user-facing strings.
`update_translations.js` helps sync keys across locale files.

## Testing notes

- Jest, default node environment. Pure-logic modules (`valuation.js`,
  `hledger.js`, `i18n.js`) are tested directly. DOM-touching modules are tested
  by mocking dependencies (see `test/treeMap.test.js` mocking `treeTable`) or
  asserting on generated HTML strings (`test/options.test.js`).
- Per the global standard in `~/.claude/CLAUDE.md`, new features/bugfixes follow
  Red/Green TDD and the suite must pass (or remaining failures be explicitly
  classified) before a task is considered done.

## Gotchas

- **Dates are handled as UTC `YYYY-MM-DD`** to dodge timezone drift. `main.js`
  formats with `moment.utc(...)`; `ui.js` reconstructs `new Date(str + 'T00:00:00Z')`.
  Keep new date code in UTC.
- **`csv` vs `csv -B` line-count mismatch**: ledger sometimes emits a different
  number of rows for market vs cost output. `valuation.js` detects this and
  falls back to `date|account` map-based matching instead of positional pairing.
- Loose root-level `test-*.js` / `test-*.ledger` files and the `Entwicklung/`
  folder are ad-hoc scratch/experiment files, not part of the Jest suite.
- The renderer still relies on jQuery + Bootstrap 4 + DataTables + ECharts
  (required globally in `ui.js`); it is not a reactive/component framework.
