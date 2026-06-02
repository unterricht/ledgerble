# Ledgerble Redesign — „Quiet Ledger" — Design Spec

_Datum: 2026-06-02 · Status: freigegeben (Architektur), bereit für Implementierungsplan_

## Quelle der Wahrheit

Das visuelle Design („**das Was**") ist das von Claude Design erstellte Mockup. Es liegt
**nur lokal** unter `Entwicklung/redesign/` (per `.gitignore` ausgeschlossen — enthält private
Gespräche, darf nicht auf GitHub):

- `Entwicklung/redesign/README.md` — Handoff-Anweisung
- `Entwicklung/redesign/chats/chat1..3.md` — die Iterationen mit dem Nutzer (die **Intent**)
- ~~`colors_and_type.css`~~ — frühe warme Gerbil-Token-Iteration, vom Nutzer verworfen, **gelöscht**.
  Finale Tokens stehen in `rd-base.jsx`.
- `Entwicklung/redesign/project/ui_kits/ledgerble/Ledgerble Redesign.html` — **primäres Design**, lädt:
  - `rd-base.jsx` — Tokens `T`, Icons, `Segmented`, `Eyebrow`, `Num`, `money`/`kfmt`
  - `rd-charts.jsx` — `IEBarChart`, `AreaLineChart`, `BarBreakdown`/`BarNode`
  - `rd-views.jsx` — `OverviewView`, `BalanceView`, `PostingsView`, `StatStrip`, `pickCats`
  - `rd-views2.jsx` — `TreemapView` (→ Breakdown), `AssetsView`, `PortfolioView`, `OptionsView`
  - `rd-shell.jsx` — Shell, Chrome (mac/win), Source-List-Nav, Inspector, File-Menü, Suche
  - `tweaks-panel.jsx` — **nur Design-Demo** (Plattform/Netto-Farbe/Top-N live umschalten); nicht produktiv

> Wichtig: Die **finalen Tokens** sind die in `rd-base.jsx` (Graphit + Pine `#2E6E5D`). Die warme
> Gerbil-Palette (`colors_and_type.css`) wurde in chat2 verworfen und ist gelöscht.

## Designrichtung

„Quiet Ledger": Ruhe, Stabilität, Seriosität — eine Finanz-App im Apple-HIG-Geist.
Kühle Graphit-Neutraltöne, **ein** geerdeter Akzent (Pine-Grün `#2E6E5D`), tabellarische
Mono-Ziffern, minimale Animation. Der Gerbil erscheint **genau einmal**, klein, in der Titelleiste.

## Bestätigte Architektur-Entscheidungen

1. **Renderer: React-Rewrite.** Die Präsentationsschicht wird als React-Komponenten neu gebaut,
   nah am Mockup. Grund: Mockup ist bereits React; isolierte, testbare Komponenten verhindern
   AI-Spaghetti (Wartung künftig durch Claude Code, wenige neue Features). Die Datenschicht
   (`main.js`, `preload.js`, `valuation.js`, `accountFilter.js`, `currency.js`, `i18n.js`,
   `hledger.js`, Parsing) **bleibt unangetastet** und behält ihre Tests.
2. **Charts: ECharts re-themen** (in React-Wrapper gekapselt), Quiet-Ledger-Palette/Fonts.
   Empfehlung des Design-Autors: ECharts produktiv behalten (Animation/Zoom). Ausnahme: die
   Expenses/Income-**Treemap entfällt** zugunsten der Balken-Aufschlüsselung (das ist eine
   bewusste funktionale Neugestaltung, kein Chart-Typ-Tausch).
3. **Fenster-Chrome: frameless + custom, plattform-adaptiv.**
4. **Netto-Linie: fix lila `#7A47C2`** (Nutzerwahl). **Top-N-Default: `top5`.**
5. **DataTables entfällt.** Postings als eigene Tabelle; **Spalten-Sortierung wird nachgebaut**
   (Nutzerwunsch: erstmal behalten), Default Datum absteigend. Export wird durch „Print to PDF" abgedeckt.
6. **Zahlenformatierung: bestehende Formatter behalten** (`currencyformatter.js` / `numeral` /
   `currency-symbol-map`) — sie beherrschen beliebige Commodities; `money()` aus dem Mockup wird nur
   fürs Layout/Styling adaptiert, nicht als Formatter übernommen.
7. **App-Icon: Gerbil.** Das generische GNOME-`emblem_library`-Icon wird durch den Gerbil ersetzt
   (Dock/Taskleiste, mac `.icns` + win `.ico` + png) via electron-builder-Config.

## Schichten / Verzeichnisse (Renderer neu)

```
main process (BLEIBT weitgehend)        renderer (NEU, React, CommonJS+JSX)
──────────────────────────────────      ───────────────────────────────────
main.js     ledger/hledger parse   →    src/data/      Adapter (reine Fns, TDD)
preload.js  window.api (+platform,  →    src/store/     Parsed-Abo, App-State (Context)
            window controls)             src/app/       Shell, Chrome, Sidebar, Inspector
valuation.js (getestet)            →    src/views/     Overview/Balance/Expenses/Income/
i18n.js     (beide Prozesse)              …            Assets/Portfolio/Postings/Options
settings-store                      →    src/charts/    ECharts-Wrapper (re-themed)
                                         src/ui/        Tokens(T), Icon, Segmented, Num, …
```

Datenfluss neu: React-Store abonniert `window.api.onParsed`, hält `files`/`deselectedAccounts`/
`currency`/`period`/`dateRange`/`query`/`activeView`/`expandedNodes`. Ein `useMemo` ruft
`valuation.js` + die Adapter und liefert View-Models. **Keine** globalen `window.update`/
`window.state`-Kopplungen mehr.

## Adapter (die Naht alt → neu, TDD-kritisch)

Pro View eine reine Funktion, die echte Postings/`valResult`/`balances` in die vom Mockup
erwartete Form bringt. Beispiele:

- `buildOverview(postings, intervals, formatter) → { monthly:[{m,inc,exp}], income[], expenses[], statStrip }`
- `buildBreakdownTree(postings, kind) → BarNode[]` — hierarchischer Baum; pro Elternknoten mit
  Restbetrag (`value − Σkinder > 0`) eine explizite `__direct`-Zeile („· not itemised") statt
  Mystery-Box. Löst das `Expenses:School` 1000 € / `:Eraser` 1 € Problem.
- `buildBalanceTree(balances, typeExtractor) → node[]` inkl. Net-Worth-Summe.
- `buildAssetsSeries(balances, intervals) → { data, series, maxY, grid }`.
- `buildPortfolio(valResult, valuationService, currency) → { totals, holdings, totals row }`.
- `pickCats(rows, rule)` (aus `rd-views.jsx` übernehmen) für Top-N/„75% of spend"/All + „Other"-Zeile.
- `filterPostings(query, typeFilter)` für Suche/Postings.

## Komponenten-Inventar (aus Mockup, 1:1)

- **Atome** (`rd-base.jsx`): `T` (Tokens), `Icon` (eigene monoline SVG-Pfade — inkl. income/
  expenses = Hand+Münze+Pfeil, portfolio = Torte), `Segmented`, `Eyebrow`, `Num`, `money`/`kfmt`.
- **Shell** (`rd-shell.jsx`): `TrafficLights`/`WinControls`, `MenuSelect`, `SearchField`,
  `AcctNode`/`Inspector` (Datumsbereich + Konten-Baum + „Showing X of Y"), `NavItem`,
  `JournalFooter` (Open File…/Reload/Reveal/Remove, leer = „Open ledger file…"), `FileMenu`
  (Open ⌘O/Reload ⌘R/Print ⌘P/Print to PDF), `MacMenuBar`, `Shell`.
- **Charts** (`rd-charts.jsx`): `IEBarChart` (Balken + lila Netto-Linie mit weißem Halo,
  Nulllinie, roter Negativ-Fläche, Tooltip), `AreaLineChart` (Assets/Portfolio), `BarBreakdown`/
  `BarNode` (Drill-down). → In Produktion als **ECharts-re-themed** umgesetzt; `BarBreakdown` ist
  HTML/CSS (kein Chart) und wird 1:1 übernommen.
- **Views** (`rd-views*.jsx`): `StatStrip`, `OverviewView`, `BalanceView`, `PostingsView`,
  `TreemapView` (= Breakdown mit „Visual"/„Text"-Umschalter + Prozente), `AssetsView`,
  `PortfolioView`, `OptionsView`.

## Fenster-Chrome (main.js / preload.js)

- **macOS:** `titleBarStyle: 'hiddenInset'`. Native Ampeln bleiben sichtbar; darüber eigene
  Unified-Toolbar (Brand „Ledger**ble**" + Suche rechts). **Natives Menü** (`menu.js`) bleibt
  (Datei/Print etc., globale Menüleiste oben). Ecken 13px, SF Pro / SF Mono.
- **Windows:** `frame: false`. Eigene Fenstersteuerung rechts (min/max/close) über **neue IPC**:
  `preload.js` exponiert `window.api.windowControls.{minimize,maximize,close}`, `main.js`
  `ipcMain`-Handler. In-Fenster-Menüleiste (File/Edit/View/Help) löst dieselben Aktionen wie
  `menu.js` aus. Ecken 8px, Segoe UI / Cascadia.
- `window.api.platform` (aus `process.platform`) steuert Fonts (CSS-Vars `--rd-sans`/`--rd-mono`),
  Chrome-Variante und Eck-Radius. **Kein** User-Toggle (der `tweaks-panel`-Schalter war Demo).

## Neue Features (Design „mit Leben" füllen)

- **Suche:** Toolbar-Eingabe → Store-`query`; wenn nicht-leer und View ≠ Postings → View auf
  „Postings" wechseln; Postings filtert nach Payee/Konto/Datum (case-insensitive substring).
- **Prozente:** Breakdown (Anteil an Summe, `<1%`-Sonderfall, „not itemised"-%), Text-Ansicht
  (% je Zeile), Stat-Strip (Savings-Rate = Net/Income), Portfolio (Unrealised %).
- **Top-N-Regel:** neue persistente Einstellung `options.overview.catRule`
  (Werte `top3|top5|top8|p75|all`, Default `top5`). Muss in `main.js` `knownKeys` **und** in der
  Options-Form auftauchen. „Other"-Zeile aufklappbar → „show N more" / „Collapse".
- **Filter/Periode/Währung auf allen Report-Tabs** (overview/balance/expenses/income/assets/
  portfolio); Periode steuert Bucketing, bei Balance den Stichtags-Verlauf.
- **Drucken:** `window.print()`, ausgelöst über File-Menü → Print… und ⌘P/Ctrl+P. Print-CSS
  blendet Chrome (Menü/Sidebar/Inspector/Toolbar) aus, zeigt `#printHeader` (Report · Datei ·
  Zeitraum · Währung · Datum) und lässt den aktiven Report seitenfüllend fließen. `print.js`-Logik
  wird in die React-Welt übernommen.

## Build & Dependencies

- `package.json`: esbuild-Bundle-Entry → `src/app/index.jsx`, JSX/automatic-runtime aktivieren.
  **Neu:** `react`, `react-dom`. **Neu devDep:** `jsdom`/`@testing-library/react`/
  `@testing-library/jest-dom` (Jest `testEnvironment: jsdom` für Komponententests; Logik-Tests
  bleiben node).
- **Raus aus dem Renderer:** jQuery, Bootstrap, DataTables(+Plugins), jquery-treetable, jquery-ui,
  streamjs (Renderer-seitig). **ECharts bleibt.** `numeral`/`currencyformatter.js`/
  `currency-symbol-map` **bleiben** für Formatierung (beliebige Commodities); `money()` aus dem
  Mockup nur fürs Layout adaptieren, nicht als Formatter.
- **App-Icon:** electron-builder-`build.{mac,win,linux}.icon` auf Gerbil umstellen; `icons/gerbil.png`
  → `.icns`/`.ico` ableiten. `BrowserWindow`-Icon (Linux/Win-Runtime) ebenfalls auf Gerbil.
- `index.html`: auf `<div id="root">` + Mount + Basis-Style (Tokens, Scrollbars, Print-`@media`,
  Hintergrund) reduziert. CSP beibehalten; **keine** Google-Fonts (offline/CSP) → System-SF/Segoe-Stack
  wie im finalen Mockup.

## i18n

Alle neuen Strings als Keys in **alle 12** `locales/*.json` (en, de, es, fr, it, ja, ko, nl, pl,
pt, ru, zh-CN): u. a. `stat.income/expenses/net_saved/savings_rate`, `overview.largest_categories`,
`toggle.visual`, `breakdown.not_itemised`, `breakdown.share_of_total`, `breakdown.category/amount`,
`filter.date_range/accounts/all/none/showing_x_of_y`, `nav.reports/ledger`, `menu.file/edit/view/
window/help`, `file.open/reload/reveal/remove/print/print_pdf/open_ledger`, `search.placeholder`,
`portfolio.cost_basis/market_value/unrealised_gain`, `assets.total_assets`, `options.*` neu.
Komponenten nutzen `t('key')`; `data-i18n` (DOM-Attribut-Ansatz) entfällt im Renderer.
`update_translations.js` zum Synchronisieren der Keys nutzen.

## Settings (Persistenz)

`main.js` hat eine harte `knownKeys`-Liste für `getAll`. Neue Keys dort **und** in der Options-Form
ergänzen, sonst überleben sie keinen Neustart:
- `options.overview.catRule` (Default `top5`).
- Bestehende Keys (ledger-Pfad, hledger-Toggle, 4–5 Regexe, locale) bleiben; Options-Form im neuen
  GroupCard-Stil (`rd-views2.jsx` `OptionsView`) nachbauen, an `getSetting`/`window.api.settings.set`
  verdrahten. Filter-/Periode-/Währungs-Zustand ist Laufzeit-State (nicht zwingend persistent).

## Testing-Strategie (red/green TDD, zwingend)

1. **Adapter & reine Logik:** Jest (node), höchste Priorität — `buildOverview`, `buildBreakdownTree`
   (insb. „not itemised"-Restzeile), `buildBalanceTree`, `buildAssetsSeries`, `buildPortfolio`,
   `pickCats`, Such-/Typ-Filter. Test-first.
2. **Komponenten:** React Testing Library + jsdom — Drill-down (Chevron), Suche-Routing,
   Top-N-Toggle/„show more", Inspector-Toggle/All/None, Segmented „Visual/Text", negatives Netto,
   Plattform-Chrome (mac vs win Rendering).
3. **Datenschicht-Tests bleiben grün** (valuation, accountFilter, hledger, i18n, menu, print, options).
4. Ein Task gilt erst als fertig, wenn die Suite grün ist oder Restfehler klassifiziert + besprochen.

## Phasen (jede grün + sinnvoller Commit)

1. **Fundament** — esbuild/JSX + React, Tokens `T`, Atome (Icon/Segmented/Num/Eyebrow), leere Shell
   mountet; bestehende Tests bleiben grün.
2. **Chrome + Shell** — main.js frameless/hiddenInset + Plattform + Window-Controls-IPC; Source-List-
   Nav, Toolbar, JournalFooter, Inspector; Store mit `onParsed`-Abo; Filter/Periode/Währung verdrahtet.
3. **Overview** — Adapter + StatStrip + IEBarChart (re-themed, lila Netto, Negativ) + Top-N-Tabelle.
4. **Expenses/Income** — Breakdown-Adapter + BarBreakdown + „Visual/Text" + Prozente.
5. **Balance / Assets / Portfolio** — Adapter + re-themte Charts/Tabellen + Net-Worth/Holdings-Summen.
6. **Postings + Suche** (inkl. Spalten-Sortierung), **Options-Form** (inkl. `catRule`), **Print**
   (CSS + Header + File-Menü/⌘P), **App-Icon** (Gerbil als `.icns`/`.ico`, electron-builder-Config).
7. **i18n-Sweep** (alle 12 Locales), Politur, **alte Renderer-Dateien entfernen** (ui.js, treeMap.js,
   balance.js, assets.js, portfolio.js, incomeExpenses.js, postings.js, treeTable.js, toggle.js,
   tabVisibility.js, dateRangeSelector.js, accountFilter-Renderteil, index.html-Altlast).

## Offene/akzeptierte Trade-offs

- **DataTables-Features:** ColVis/CSV-Export entfallen (Export via „Print to PDF"). **Spalten-
  Sortierung wird nachgebaut** (Nutzerwunsch). Bestehende Zahlenformatter bleiben erhalten.
- **Fonts** sind Systemstack (SF Pro/Segoe), keine gebündelten Webfonts — bewusst (CSP/offline,
  entspricht finalem Mockup).
- **Plattform** wird automatisch erkannt; der Demo-Umschalter aus dem Mockup wird nicht übernommen.
