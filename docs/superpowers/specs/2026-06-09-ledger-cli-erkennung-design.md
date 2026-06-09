# Design: ledger-cli-Erkennung & Fehlerhinweis

**Datum:** 2026-06-09
**Status:** Entwurf, vom Nutzer freigegeben

## Problem

Wenn das `ledger`-Binary nicht gefunden wird, wirft [main.js](../../../main.js)
einen Fehler, der an den Renderer zurückgeht — dort aber in
[compute.js](../../../src/data/compute.js) **stillschweigend** herausgefiltert
wird (`if (f && !f.error)`). Der Nutzer sieht gar nichts; die Datei verschwindet
einfach. Das gilt heute für *jeden* Parse-Fehler.

Verschärfend kommt eine bekannte Electron-Falle auf macOS hinzu: Eine aus dem
Dock/Finder gestartete App erbt **nicht** den Shell-`PATH`. Sie sieht nur
`/usr/bin:/bin:...` — **nicht** `/opt/homebrew/bin`, wo Homebrew `ledger`
installiert. Der Default-Befehl ist schlicht `"ledger"`
([options.js:59](../../../options.js#L59)) und verlässt sich auf `PATH`. Damit
laufen auch kompetente Nutzer, die `brew install ledger` ausgeführt haben, beim
Erststart in „command not found".

## Ziel

1. Die PATH-Falle proaktiv lösen: gängige Installationspfade automatisch finden
   und nutzen.
2. Den verbleibenden Fall „ledger wirklich nicht installiert" mit einem
   verständlichen Hinweis sichtbar machen, statt ihn zu verschlucken.
3. Generische Parse-Fehler ebenfalls sichtbar machen (kein stilles Verschlucken
   mehr).

## Architektur

Drei Bausteine, entlang der bestehenden Prozessgrenzen.

### 1. Auto-Erkennung beim Start (Hauptprozess)

Neues Modul **`ledgerResolver.js`** — reine Logik, ohne `electron`-Import, damit
es im node-Testenv direkt testbar ist (gleiches Muster wie `knownKeys.js`,
`includes.js`).

```
findLedgerBinary(configuredCmd, { canRun, existsSync }) -> { command, changed }
```

- Probiert in Reihenfolge:
  1. den konfigurierten Befehl (Default `"ledger"`) — wenn er via
     `--version` ausführbar ist, bleibt alles unverändert
     (`{ command: configuredCmd, changed: false }`).
  2. falls nicht ausführbar (ENOENT / Exit 127): feste Kandidaten-Pfade in
     dieser Reihenfolge
     - `/opt/homebrew/bin/ledger`  (Homebrew Apple Silicon)
     - `/usr/local/bin/ledger`     (Homebrew Intel)
     - `/opt/local/bin/ledger`     (MacPorts)
     - `/usr/bin/ledger`           (System)
- Erster ausführbarer Treffer gewinnt → `{ command: pfad, changed: true }`.
- Nichts gefunden → `{ command: null, changed: false }`.

Die Abhängigkeiten (`canRun`, `existsSync`) werden injiziert, damit Tests ohne
echtes Binary laufen.

In [main.js](../../../main.js) nach `settings.init` (um Zeile 28) einmalig
aufrufen:

- aktuellen Wert `settings.value('options.ledger.command', 'ledger')` lesen,
- `findLedgerBinary` aufrufen,
- bei `changed === true` → `settings.setValue('options.ledger.command', command)`.

Dadurch zeigt die Settings-UI den echten Pfad an und der Renderer lädt ihn beim
Mount korrekt (`window.api.settings.getAll()`). Der Key
`options.ledger.command` ist bereits in [knownKeys.js](../../../knownKeys.js)
gelistet — keine Änderung dort nötig.

### 2. Fehler typisieren (Hauptprozess)

Im `catch` von [main.js:151](../../../main.js#L151) wird erkannt, ob es ein
„nicht gefunden" ist:

- Exit-Code 127, oder
- Fehlermeldung enthält `command not found` / `ENOENT` / `not found`.

Statt `"error:" + t` ein strukturiertes Objekt zurückgeben:

```js
{ type: 'ledger-not-found', message }   // Binary nicht auffindbar
{ type: 'parse-error', message }        // alles andere (Syntax, CSV, …)
```

`makeFileState` in
[useAppState.js](../../../src/store/useAppState.js#L4) speichert dieses Objekt
als `error`.

### 3. Hinweis-UI (Renderer)

[compute.js:158](../../../src/data/compute.js#L158) filtert fehlerhafte Dateien
weiterhin aus der Berechnung, aber die Fehler werden zusätzlich an die View
durchgereicht und angezeigt:

- `error.type === 'ledger-not-found'` (Auto-Erkennung ist gescheitert → ledger
  wirklich nicht installiert): gut sichtbarer Hinweis-Banner mit
  - Überschrift „ledger-cli wurde nicht gefunden",
  - kurzer Anleitung (installieren / Pfad in Einstellungen setzen),
  - Button, der die Einstellungen öffnet.
- `error.type === 'parse-error'`: kürzerer, sichtbarer Fehlerhinweis mit der
  Meldung.

Alle Texte als i18n-Keys, hinzugefügt in **allen** `locales/*.json`, referenziert
über `t('key')` — keine hartkodierten Strings.

## Datenfluss (geändert)

1. Start: `main.js` → `findLedgerBinary` → ggf. `settings.setValue`.
2. Renderer mountet, lädt Settings inkl. (ggf. korrigiertem) ledger-Pfad.
3. `window.api.parse(command, hledger, file)` wie bisher.
4. Bei Fehler: `main.js` typisiert ihn → IPC `parsed` mit `error`-Objekt.
5. `useAppState` speichert `error`-Objekt → `Shell`/View zeigt Banner.

## Fehlerbehandlung

- Auto-Erkennung findet nichts → Pfad bleibt `"ledger"`, Parse schlägt fehl,
  `ledger-not-found`-Banner erscheint. Erwartetes, sauber kommuniziertes Ende.
- `--version`-Probe selbst wirft → als „nicht ausführbar" behandeln, nächster
  Kandidat.

## Tests (TDD, Red/Green)

- **`ledgerResolver.test.js`** (node-Env):
  - konfigurierter Befehl ausführbar → unverändert (`changed: false`).
  - konfigurierter Befehl nicht ausführbar, Kandidat existiert → erster Treffer
    gewinnt, `changed: true`.
  - Reihenfolge der Kandidaten wird respektiert.
  - kein Kandidat ausführbar → `{ command: null }`.
- **Fehler-Typisierung** (Einheit, ggf. in `main`-Testdatei wie bestehende
  main-Handler-Tests): Exit 127 / ENOENT → `ledger-not-found`; sonst
  `parse-error`.
- **Renderer** (jsdom, `*.test.jsx`): Datei-State mit
  `error.type === 'ledger-not-found'` → Banner sichtbar, Button vorhanden;
  `parse-error` → Fehlerhinweis sichtbar.

## Bewusst außen vor (YAGNI)

- **hledger-Autoerkennung** — eigene Einstellung (`options.hledger`), nicht der
  Default-Pfad. Symmetrisch später nachrüstbar.
- **Login-Shell-PATH-Abfrage** (`zsh -lic 'which ledger'`) — die feste
  Kandidatenliste deckt brew/MacPorts/System ab; Shell-Abfrage wäre langsamer
  und shell-abhängig.
- **Windows/Linux-Pfade** — Kandidatenliste ist macOS-fokussiert (primäres
  Zielsystem, `npm run dist` baut mac arm64). Auf anderen Systemen greift weiter
  die `PATH`-Auflösung des konfigurierten Befehls; nur die Kandidatenliste
  bringt dort nichts.
```
