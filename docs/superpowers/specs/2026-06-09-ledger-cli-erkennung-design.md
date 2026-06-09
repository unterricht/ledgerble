# Design: ledger/hledger-Erkennung & Fehlerhinweis

**Datum:** 2026-06-09
**Status:** Entwurf, vom Nutzer freigegeben

## Problem

Wenn das `ledger`- (bzw. `hledger`-) Binary nicht gefunden wird, wirft
[main.js](../../../main.js) einen Fehler, der an den Renderer zurückgeht — dort
aber in [compute.js](../../../src/data/compute.js) **stillschweigend**
herausgefiltert wird (`if (f && !f.error)`). Der Nutzer sieht gar nichts; die
Datei verschwindet einfach. Das gilt heute für *jeden* Parse-Fehler.

Verschärfend kommt eine bekannte Electron-Falle hinzu: Eine aus dem
Dock/Finder/Startmenü gestartete App erbt **nicht** den Shell-`PATH`. Auf macOS
sieht sie nur `/usr/bin:/bin:...` — **nicht** `/opt/homebrew/bin`, wo Homebrew
`ledger` installiert. Damit laufen auch kompetente Nutzer, die
`brew install ledger` ausgeführt haben, beim Erststart in „command not found".
Auf Linux/Windows besteht dasselbe Problem für home-relative Installationsorte
(z. B. `~/.local/bin`, wohin `stack`/`cabal` `hledger` legen).

Zwei bestehende Schwächen, die dabei mit aufgeräumt werden:

- **hledger hat keinen eigenen Binary-Pfad.** Der Renderer sendet immer
  `options.ledger.command` als Befehl und `options.hledger` nur als Bool-Flag
  ([Shell.jsx:451-453](../../../src/app/Shell.jsx#L451-L453)). Im hledger-Modus
  wird also das *ledger*-Binary aufgerufen — faktisch kaputt, solange der Nutzer
  nicht manuell `options.ledger.command` auf `hledger` umbiegt.
- **Zwei divergierende Default-Quellen.** Der Renderer hat bereits ein
  plattformabhängiges Default
  ([Shell.jsx:42-47](../../../src/app/Shell.jsx#L42-L47),
  `darwin → /opt/homebrew/bin/ledger`, `linux → /usr/bin/ledger`), das vom
  Default `"ledger"` in [options.js:59](../../../options.js#L59) abweicht.

## Ziel

1. Die PATH-Falle proaktiv lösen: gängige Installationspfade für **ledger und
   hledger** auf **macOS, Linux und Windows** automatisch finden und nutzen.
2. hledger zu einer vollwertigen Option machen — eigener Binary-Pfad, eigene
   Erkennung.
3. Den verbleibenden Fall „Binary wirklich nicht installiert" mit einem
   verständlichen Hinweis sichtbar machen, statt ihn zu verschlucken.
4. Generische Parse-Fehler ebenfalls sichtbar machen.

ledger und hledger werden durchgehend als gleichwertige, vollwertige Optionen
behandelt; macOS, Linux und Windows ebenso.

## Architektur

Drei Bausteine, entlang der bestehenden Prozessgrenzen.

### 1. Auto-Erkennung beim Start (Hauptprozess)

Neues Modul **`binaryResolver.js`** — reine Logik, ohne `electron`-Import, damit
es im node-Testenv direkt testbar ist (gleiches Muster wie `knownKeys.js`,
`includes.js`).

```
findBinary(binaryName, configuredCmd, { platform, homedir, canRun })
    -> { command, changed }
```

- `binaryName` ist `'ledger'` oder `'hledger'`.
- Probiert in Reihenfolge:
  1. den konfigurierten Befehl — wenn er via `--version` ausführbar ist, bleibt
     alles unverändert (`{ command: configuredCmd, changed: false }`).
  2. falls nicht ausführbar (ENOENT / Exit 127): die plattform- und
     binaryspezifische Kandidatenliste (siehe unten), erster ausführbarer
     Treffer gewinnt → `{ command: pfad, changed: true }`.
- Nichts gefunden → `{ command: null, changed: false }`.

`platform`, `homedir` und `canRun` werden injiziert, damit Tests ohne echtes
Binary und plattformunabhängig laufen.

**Kandidatenlisten** (`~` = injizierter `homedir`):

- **macOS** (`darwin`)
  - ledger:  `/opt/homebrew/bin/ledger`, `/usr/local/bin/ledger`,
    `/opt/local/bin/ledger`, `/usr/bin/ledger`
  - hledger: `/opt/homebrew/bin/hledger`, `/usr/local/bin/hledger`,
    `~/.local/bin/hledger`, `~/.ghcup/bin/hledger`
- **Linux**
  - ledger:  `/usr/bin/ledger`, `/usr/local/bin/ledger`, `/snap/bin/ledger`
  - hledger: `~/.local/bin/hledger`, `~/.ghcup/bin/hledger`,
    `/usr/bin/hledger`, `/usr/local/bin/hledger`, `/snap/bin/hledger`
- **Windows** (`win32`, alle mit `.exe`)
  - ledger:  `C:\msys64\usr\bin\ledger.exe`, `~\scoop\shims\ledger.exe`,
    `C:\ProgramData\chocolatey\bin\ledger.exe`
  - hledger: `~\AppData\Roaming\local\bin\hledger.exe`,
    `~\scoop\shims\hledger.exe`, `~\AppData\Local\Programs\hledger\hledger.exe`

In [main.js](../../../main.js) nach `settings.init` (um Zeile 28) einmalig für
**beide** Binaries aufrufen:

- `options.ledger.command` (Default `"ledger"`) auflösen,
- `options.hledger.command` (Default `"hledger"`, **neuer Key**) auflösen,
- bei `changed === true` jeweils `settings.setValue(key, command)`.

Dadurch zeigt die Settings-UI den echten Pfad und der Renderer lädt ihn beim
Mount korrekt. Das plattformabhängige Default in
[Shell.jsx:42-47](../../../src/app/Shell.jsx#L42-L47) bleibt nur noch als
defensiver Fallback; die persistierten Resolver-Werte sind die Wahrheitsquelle.

### Neue Einstellung: hledger-Befehl

- Neuer Key `options.hledger.command` (Default `"hledger"`), hinzugefügt in
  [knownKeys.js](../../../knownKeys.js) (sonst überlebt er keinen Neustart) und
  als `FILE`-Setting in [options.js](../../../options.js) — analog zu
  `options.ledger.command`, damit er in der Settings-UI editierbar ist.
- Renderer ([Shell.jsx:451-453](../../../src/app/Shell.jsx#L451-L453),
  [Shell.jsx:469](../../../src/app/Shell.jsx#L469)): wählt den Befehl anhand des
  `options.hledger`-Flags — Flag an → `options.hledger.command`, sonst
  `options.ledger.command`.
- i18n-Keys `settings.hledger_command` / `settings.hledger_command.help` in
  **allen** `locales/*.json`.

### 2. Fehler typisieren (Hauptprozess)

Im `catch` von [main.js:151](../../../main.js#L151) wird erkannt, ob es ein
„nicht gefunden" ist (Exit-Code 127, oder Meldung enthält `command not found` /
`ENOENT` / `not found` / `is not recognized` (Windows)).

Statt `"error:" + t` ein strukturiertes Objekt zurückgeben:

```js
{ type: 'binary-not-found', tool: 'ledger' | 'hledger', message }
{ type: 'parse-error', message }
```

`tool` ergibt sich aus dem `hledger`-Flag des Parse-Aufrufs.
`makeFileState` in [useAppState.js](../../../src/store/useAppState.js#L4)
speichert dieses Objekt als `error`.

### 3. Hinweis-UI (Renderer)

[compute.js:158](../../../src/data/compute.js#L158) filtert fehlerhafte Dateien
weiterhin aus der Berechnung, aber die Fehler werden zusätzlich an die View
durchgereicht und angezeigt:

- `error.type === 'binary-not-found'`: gut sichtbarer Hinweis-Banner mit
  - Überschrift „{tool} wurde nicht gefunden" (`tool` eingesetzt),
  - kurzer Anleitung (installieren / Pfad in Einstellungen setzen),
  - Button, der die Einstellungen öffnet.
- `error.type === 'parse-error'`: kürzerer, sichtbarer Fehlerhinweis mit der
  Meldung.

Alle Texte als i18n-Keys in **allen** `locales/*.json`, referenziert über
`t('key')` — keine hartkodierten Strings.

## Datenfluss (geändert)

1. Start: `main.js` → `findBinary('ledger', …)` und `findBinary('hledger', …)`
   → ggf. `settings.setValue`.
2. Renderer mountet, lädt Settings inkl. (ggf. korrigierter) Pfade.
3. `window.api.parse(command, hledger, file)` — `command` ist je nach
   `options.hledger`-Flag der ledger- oder hledger-Pfad.
4. Bei Fehler: `main.js` typisiert ihn → IPC `parsed` mit `error`-Objekt.
5. `useAppState` speichert `error`-Objekt → `Shell`/View zeigt Banner.

## Fehlerbehandlung

- Auto-Erkennung findet nichts → Pfad bleibt der konfigurierte Default, Parse
  schlägt fehl, `binary-not-found`-Banner erscheint. Erwartetes, sauber
  kommuniziertes Ende.
- `--version`-Probe selbst wirft → als „nicht ausführbar" behandeln, nächster
  Kandidat.

## Tests (TDD, Red/Green)

- **`binaryResolver.test.js`** (node-Env, injizierte `platform`/`homedir`/
  `canRun`):
  - konfigurierter Befehl ausführbar → unverändert (`changed: false`).
  - konfigurierter Befehl nicht ausführbar, Kandidat existiert → erster Treffer
    gewinnt, `changed: true`.
  - Reihenfolge der Kandidaten wird respektiert.
  - korrekte Liste je Plattform (`darwin`/`linux`/`win32`) und je Binary
    (`ledger`/`hledger`); `~` wird zu `homedir` expandiert; Windows nutzt
    `.exe`.
  - kein Kandidat ausführbar → `{ command: null }`.
- **Fehler-Typisierung** (Einheit, analog zu bestehenden main-Handler-Tests):
  Exit 127 / ENOENT / „is not recognized" → `binary-not-found` mit korrektem
  `tool`; sonst `parse-error`.
- **hledger-Befehlswahl** (Renderer/Einheit): `options.hledger` an → es wird
  `options.hledger.command` an `parse` übergeben; aus → `options.ledger.command`.
- **Renderer** (jsdom, `*.test.jsx`): Datei-State mit
  `error.type === 'binary-not-found'` → Banner mit korrektem Tool-Namen und
  Button sichtbar; `parse-error` → Fehlerhinweis sichtbar.

## Bewusst außen vor (YAGNI)

- **Login-Shell-PATH-Abfrage** (`zsh -lic 'which ledger'`) — die plattform- und
  binaryspezifischen Kandidatenlisten decken brew/MacPorts/snap/stack/scoop/
  choco/msys2 ab; eine Shell-Abfrage wäre langsamer und shell-abhängig.
- **Beliebige weitere Installationsorte** — die Listen decken die verbreiteten
  Paketmanager je Plattform ab. Exotische Orte bleiben über das manuell
  editierbare Befehls-Setting erreichbar (der `binary-not-found`-Banner verweist
  genau dorthin).
