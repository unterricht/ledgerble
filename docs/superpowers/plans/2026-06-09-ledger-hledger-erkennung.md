# ledger/hledger-Erkennung & Fehlerhinweis – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ledger und hledger auf macOS/Linux/Windows automatisch finden, hledger zu einer vollwertigen Option mit eigenem Binary-Pfad machen, und „Binary nicht gefunden"/Parse-Fehler im UI sichtbar statt stillschweigend verschluckt anzeigen.

**Architecture:** Ein reines Logikmodul `binaryResolver.js` (plattform-/binaryspezifische Kandidatenlisten + `findBinary` + `resolveBinaries`) wird beim Start in `main.js` mit echten Abhängigkeiten aufgerufen und persistiert gefundene Pfade in `settings-store`. Ein zweites reines Modul `parseError.js` klassifiziert Fehler (`binary-not-found` vs. `parse-error`); `main.js` schickt das strukturierte Objekt via IPC. Der React-Renderer wählt je nach `options.hledger`-Flag den richtigen Befehl und zeigt fehlerhafte Dateien als Banner an.

**Tech Stack:** CommonJS (Node), Electron (main/preload/renderer), React 18, Jest (+ jsdom für `*.test.jsx`), settings-store, i18n via `i18n.js` + `locales/*.json`.

---

## File Structure

- **Create** `binaryResolver.js` (root) — Kandidatenlisten je Plattform/Binary, `findBinary`, `resolveBinaries`. Reine Logik, kein `electron`/`fs`-Import (Abhängigkeiten injiziert).
- **Create** `parseError.js` (root) — `classifyParseError(err, tool)` → strukturiertes Fehlerobjekt. Reine Logik.
- **Create** `test/binaryResolver.test.js`, `test/parseError.test.js`.
- **Modify** `main.js` — Resolver beim Start aufrufen + persistieren; `parse()`-catch nutzt `classifyParseError`.
- **Modify** `knownKeys.js` — Key `options.hledger.command` ergänzen.
- **Modify** `options.js` — `options.hledger.command` als `FILE`-Setting registrieren.
- **Modify** `src/app/Shell.jsx` — Befehlswahl (ledger/hledger), `SETTINGS_DEFAULTS`, Fehler-Banner.
- **Modify** `locales/*.json` (alle 12) — neue i18n-Keys.
- **Modify** `test/i18n-redesign-keys.test.js`-Schwester: neuer Key-Präsenz-Test `test/i18n-binary-keys.test.js`.
- **Create** `test/Shell.errorBanner.test.jsx`, `test/Shell.commandPick.test.jsx`.
- **Modify** `test/catRule-known-key.test.js`-Schwester: `test/hledgerCommand-known-key.test.js`.

---

## Task 1: `binaryResolver.js` — Kandidatenlisten & `findBinary`

**Files:**
- Create: `binaryResolver.js`
- Test: `test/binaryResolver.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/binaryResolver.test.js
const { candidatesFor, findBinary } = require('../binaryResolver');

describe('candidatesFor', () => {
  test('macOS ledger list, in order', () => {
    expect(candidatesFor('darwin', 'ledger', '/Users/x')).toEqual([
      '/opt/homebrew/bin/ledger', '/usr/local/bin/ledger',
      '/opt/local/bin/ledger', '/usr/bin/ledger',
    ]);
  });
  test('macOS hledger expands ~ to homedir', () => {
    expect(candidatesFor('darwin', 'hledger', '/Users/x')).toEqual([
      '/opt/homebrew/bin/hledger', '/usr/local/bin/hledger',
      '/Users/x/.local/bin/hledger', '/Users/x/.ghcup/bin/hledger',
    ]);
  });
  test('linux hledger prefers ~/.local/bin', () => {
    expect(candidatesFor('linux', 'hledger', '/home/x')[0]).toBe('/home/x/.local/bin/hledger');
  });
  test('windows ledger uses .exe and backslashes', () => {
    expect(candidatesFor('win32', 'ledger', 'C:\\Users\\x')).toEqual([
      'C:\\msys64\\usr\\bin\\ledger.exe',
      'C:\\Users\\x\\scoop\\shims\\ledger.exe',
      'C:\\ProgramData\\chocolatey\\bin\\ledger.exe',
    ]);
  });
});

describe('findBinary', () => {
  const deps = (runnable) => ({
    platform: 'darwin', homedir: '/Users/x',
    canRun: (cmd) => runnable.includes(cmd),
  });

  test('configured command works -> unchanged', () => {
    expect(findBinary('ledger', 'ledger', deps(['ledger'])))
      .toEqual({ command: 'ledger', changed: false });
  });
  test('configured missing, first candidate wins', () => {
    expect(findBinary('ledger', 'ledger', deps(['/usr/local/bin/ledger', '/opt/homebrew/bin/ledger'])))
      .toEqual({ command: '/opt/homebrew/bin/ledger', changed: true });
  });
  test('candidate order respected', () => {
    expect(findBinary('ledger', 'ledger', deps(['/usr/bin/ledger'])))
      .toEqual({ command: '/usr/bin/ledger', changed: true });
  });
  test('nothing runnable -> null', () => {
    expect(findBinary('ledger', 'ledger', deps([])))
      .toEqual({ command: null, changed: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/binaryResolver.test.js`
Expected: FAIL — `Cannot find module '../binaryResolver'`.

- [ ] **Step 3: Write minimal implementation**

```js
// binaryResolver.js
// Pure logic: locates the ledger/hledger binary across platforms.
// No electron/fs imports — platform, homedir and canRun are injected so the
// module is unit-testable and the browser bundle never needs Node built-ins.

function join(base, parts, sep) {
  return base.replace(/[\\/]+$/, '') + sep + parts.join(sep);
}

// Returns the ordered list of absolute candidate paths to probe for `binary`
// ('ledger' | 'hledger') on `platform`, with `~` expanded to `homedir`.
function candidatesFor(platform, binary, homedir) {
  if (platform === 'win32') {
    const exe = binary + '.exe';
    const home = (parts) => join(homedir, parts, '\\');
    if (binary === 'hledger') {
      return [
        home(['AppData', 'Roaming', 'local', 'bin', exe]),
        home(['scoop', 'shims', exe]),
        home(['AppData', 'Local', 'Programs', 'hledger', exe]),
      ];
    }
    return [
      'C:\\msys64\\usr\\bin\\' + exe,
      home(['scoop', 'shims', exe]),
      'C:\\ProgramData\\chocolatey\\bin\\' + exe,
    ];
  }
  const home = (parts) => join(homedir, parts, '/');
  if (platform === 'darwin') {
    if (binary === 'hledger') {
      return [
        '/opt/homebrew/bin/hledger', '/usr/local/bin/hledger',
        home(['.local', 'bin', 'hledger']), home(['.ghcup', 'bin', 'hledger']),
      ];
    }
    return [
      '/opt/homebrew/bin/ledger', '/usr/local/bin/ledger',
      '/opt/local/bin/ledger', '/usr/bin/ledger',
    ];
  }
  // linux (and any other POSIX)
  if (binary === 'hledger') {
    return [
      home(['.local', 'bin', 'hledger']), home(['.ghcup', 'bin', 'hledger']),
      '/usr/bin/hledger', '/usr/local/bin/hledger', '/snap/bin/hledger',
    ];
  }
  return ['/usr/bin/ledger', '/usr/local/bin/ledger', '/snap/bin/ledger'];
}

// Resolves the binary: keep the configured command if it runs, otherwise probe
// the platform candidate list. Returns { command, changed }.
function findBinary(binary, configuredCmd, { platform, homedir, canRun }) {
  if (configuredCmd && canRun(configuredCmd)) {
    return { command: configuredCmd, changed: false };
  }
  for (const cand of candidatesFor(platform, binary, homedir)) {
    if (canRun(cand)) return { command: cand, changed: true };
  }
  return { command: null, changed: false };
}

module.exports = { candidatesFor, findBinary };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/binaryResolver.test.js`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add binaryResolver.js test/binaryResolver.test.js
git commit -m "feat: binaryResolver — plattformweite ledger/hledger-Pfaderkennung"
```

---

## Task 2: `resolveBinaries` — beide Binaries auflösen & persistieren

**Files:**
- Modify: `binaryResolver.js`
- Test: `test/binaryResolver.test.js`

- [ ] **Step 1: Write the failing test (append to existing file)**

```js
// test/binaryResolver.test.js — append
const { resolveBinaries } = require('../binaryResolver');

describe('resolveBinaries', () => {
  function harness(runnable, stored) {
    const store = { ...stored };
    const sets = [];
    return {
      result: resolveBinaries({
        platform: 'darwin', homedir: '/Users/x',
        canRun: (cmd) => runnable.includes(cmd),
        getSetting: (k, d) => (k in store ? store[k] : d),
        setSetting: (k, v) => { store[k] = v; sets.push([k, v]); },
      }),
      store, sets,
    };
  }

  test('persists newly found ledger and hledger paths', () => {
    const { sets } = harness(['/opt/homebrew/bin/ledger', '/opt/homebrew/bin/hledger'], {});
    expect(sets).toEqual([
      ['options.ledger.command', '/opt/homebrew/bin/ledger'],
      ['options.hledger.command', '/opt/homebrew/bin/hledger'],
    ]);
  });
  test('does not write when configured command already runs', () => {
    const { sets } = harness(['ledger', 'hledger'],
      { 'options.ledger.command': 'ledger', 'options.hledger.command': 'hledger' });
    expect(sets).toEqual([]);
  });
  test('does not write when nothing is found', () => {
    const { sets } = harness([], {});
    expect(sets).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/binaryResolver.test.js -t resolveBinaries`
Expected: FAIL — `resolveBinaries is not a function`.

- [ ] **Step 3: Write minimal implementation (add to `binaryResolver.js`)**

```js
// binaryResolver.js — add before module.exports

// Resolves both binaries against settings and persists any path that changed.
// `getSetting(key, default)` / `setSetting(key, value)` wrap the settings store.
function resolveBinaries({ platform, homedir, canRun, getSetting, setSetting }) {
  const jobs = [
    { binary: 'ledger',  key: 'options.ledger.command',  def: 'ledger' },
    { binary: 'hledger', key: 'options.hledger.command', def: 'hledger' },
  ];
  const summary = {};
  for (const { binary, key, def } of jobs) {
    const configured = getSetting(key, def);
    const res = findBinary(binary, configured, { platform, homedir, canRun });
    if (res.changed && res.command) setSetting(key, res.command);
    summary[binary] = res;
  }
  return summary;
}
```

Update the export line:

```js
module.exports = { candidatesFor, findBinary, resolveBinaries };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/binaryResolver.test.js`
Expected: PASS (resolver + findBinary + candidatesFor).

- [ ] **Step 5: Commit**

```bash
git add binaryResolver.js test/binaryResolver.test.js
git commit -m "feat: resolveBinaries — gefundene ledger/hledger-Pfade persistieren"
```

---

## Task 3: `parseError.js` — Fehlerklassifizierung

**Files:**
- Create: `parseError.js`
- Test: `test/parseError.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/parseError.test.js
const { classifyParseError } = require('../parseError');

test('ENOENT -> binary-not-found with tool', () => {
  const err = Object.assign(new Error('spawn ledger ENOENT'), { code: 'ENOENT' });
  expect(classifyParseError(err, 'ledger')).toEqual({
    type: 'binary-not-found', tool: 'ledger', message: 'spawn ledger ENOENT',
  });
});

test('exit code 127 -> binary-not-found', () => {
  const err = Object.assign(new Error('Command failed'), { code: 127 });
  expect(classifyParseError(err, 'hledger').type).toBe('binary-not-found');
});

test('windows "is not recognized" -> binary-not-found', () => {
  const err = new Error("'ledger' is not recognized as an internal or external command");
  expect(classifyParseError(err, 'ledger').type).toBe('binary-not-found');
});

test('shell "command not found" -> binary-not-found', () => {
  const err = new Error('/bin/sh: ledger: command not found');
  expect(classifyParseError(err, 'ledger').type).toBe('binary-not-found');
});

test('other errors -> parse-error with message', () => {
  const out = classifyParseError('Too few fields in CSV', 'ledger');
  expect(out).toEqual({ type: 'parse-error', message: 'Too few fields in CSV' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/parseError.test.js`
Expected: FAIL — `Cannot find module '../parseError'`.

- [ ] **Step 3: Write minimal implementation**

```js
// parseError.js
// Pure logic: turns a thrown parse error into a structured object for the IPC
// reply, distinguishing "the CLI binary was not found" from other failures.

function messageOf(err) {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (err.message) return String(err.message);
  return String(err);
}

function isBinaryNotFound(err) {
  if (err && (err.code === 'ENOENT' || err.code === 127)) return true;
  const m = messageOf(err).toLowerCase();
  return m.includes('enoent')
      || m.includes('command not found')
      || m.includes('not found')
      || m.includes('is not recognized');
}

// tool is 'ledger' | 'hledger' — which binary the failed parse was using.
function classifyParseError(err, tool) {
  const message = messageOf(err);
  if (isBinaryNotFound(err)) return { type: 'binary-not-found', tool, message };
  return { type: 'parse-error', message };
}

module.exports = { classifyParseError };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/parseError.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add parseError.js test/parseError.test.js
git commit -m "feat: parseError — ENOENT/127 als binary-not-found klassifizieren"
```

---

## Task 4: `knownKeys.js` + `options.js` — hledger-Befehl als Setting

**Files:**
- Modify: `knownKeys.js:7-19`
- Modify: `options.js:65-72`
- Test: `test/hledgerCommand-known-key.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/hledgerCommand-known-key.test.js
const { KNOWN_KEYS } = require('../knownKeys');

test('hledger command is a known persisted key', () => {
  expect(KNOWN_KEYS).toContain('options.hledger.command');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/hledgerCommand-known-key.test.js`
Expected: FAIL — `expect(received).toContain('options.hledger.command')`.

- [ ] **Step 3a: Add the key to `knownKeys.js`**

In `knownKeys.js`, add the line directly under `'options.hledger',`:

```js
  'options.ledger.command',
  'options.hledger',
  'options.hledger.command',
```

- [ ] **Step 3b: Register the setting in `options.js`**

In `options.js`, immediately after the `"options.hledger"` Setting block (the `BOOL` one ending `BOOL, null, null),`), insert:

```js
    new Setting(
        "options.hledger.command",
        "hledger",
        () => t('settings.hledger_command.help'),
        () => t('settings.hledger_command'),
        FILE,
        null,
        null),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest test/hledgerCommand-known-key.test.js test/options.test.js`
Expected: PASS (both). If `options.test.js` snapshots the settings count, update it to include the new setting.

- [ ] **Step 5: Commit**

```bash
git add knownKeys.js options.js test/hledgerCommand-known-key.test.js
git commit -m "feat: eigenes options.hledger.command-Setting (known key + UI)"
```

---

## Task 5: i18n-Keys in allen 12 Locales

**Files:**
- Modify: `locales/de.json`, `locales/en.json`, `locales/es.json`, `locales/fr.json`, `locales/it.json`, `locales/ja.json`, `locales/ko.json`, `locales/nl.json`, `locales/pl.json`, `locales/pt.json`, `locales/ru.json`, `locales/zh-CN.json`
- Test: `test/i18n-binary-keys.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/i18n-binary-keys.test.js
const fs = require('fs');
const path = require('path');
const KEYS = [
  'settings.hledger_command', 'settings.hledger_command.help',
  'error.binary_not_found.title', 'error.binary_not_found.body',
  'error.binary_not_found.action', 'error.parse_error.body',
];
const dir = path.join(__dirname, '..', 'locales');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  test(`${f} has all binary-detection keys`, () => {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    for (const k of KEYS) expect(j[k]).toBeDefined();
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/i18n-binary-keys.test.js`
Expected: FAIL — keys undefined for all locale files.

- [ ] **Step 3: Add the keys to every locale file**

Add these key/value pairs to each JSON object (the placeholder `{tool}` / `{message}` are substituted in the renderer via `.replace`). Insert near the other `settings.*` / a new block; JSON key order does not matter.

`locales/en.json`:
```json
  "settings.hledger_command": "HLedger command",
  "settings.hledger_command.help": "The command used to parse your journal files in hledger mode<br>This must be an absolute path, or on the PATH",
  "error.binary_not_found.title": "{tool} was not found",
  "error.binary_not_found.body": "Ledgerble couldn't find “{tool}”. Install it, or set its path under Options.",
  "error.binary_not_found.action": "Open Options",
  "error.parse_error.body": "Couldn't read this journal: {message}",
```

`locales/de.json`:
```json
  "settings.hledger_command": "HLedger-Befehl",
  "settings.hledger_command.help": "Der Befehl zum Einlesen deiner Journaldateien im hledger-Modus<br>Dies muss ein absoluter Pfad sein oder im PATH liegen",
  "error.binary_not_found.title": "{tool} wurde nicht gefunden",
  "error.binary_not_found.body": "Ledgerble konnte „{tool}“ nicht finden. Installiere es oder lege den Pfad unter Optionen fest.",
  "error.binary_not_found.action": "Optionen öffnen",
  "error.parse_error.body": "Dieses Journal konnte nicht gelesen werden: {message}",
```

`locales/es.json`:
```json
  "settings.hledger_command": "Comando de HLedger",
  "settings.hledger_command.help": "El comando para analizar tus archivos de diario en modo hledger<br>Debe ser una ruta absoluta o estar en el PATH",
  "error.binary_not_found.title": "No se encontró {tool}",
  "error.binary_not_found.body": "Ledgerble no pudo encontrar «{tool}». Instálalo o define su ruta en Opciones.",
  "error.binary_not_found.action": "Abrir Opciones",
  "error.parse_error.body": "No se pudo leer este diario: {message}",
```

`locales/fr.json`:
```json
  "settings.hledger_command": "Commande HLedger",
  "settings.hledger_command.help": "La commande utilisée pour analyser vos fichiers de journal en mode hledger<br>Ce doit être un chemin absolu ou figurer dans le PATH",
  "error.binary_not_found.title": "{tool} est introuvable",
  "error.binary_not_found.body": "Ledgerble n'a pas trouvé « {tool} ». Installez-le ou définissez son chemin dans les Options.",
  "error.binary_not_found.action": "Ouvrir les Options",
  "error.parse_error.body": "Impossible de lire ce journal : {message}",
```

`locales/it.json`:
```json
  "settings.hledger_command": "Comando HLedger",
  "settings.hledger_command.help": "Il comando usato per analizzare i file di diario in modalità hledger<br>Deve essere un percorso assoluto o presente nel PATH",
  "error.binary_not_found.title": "{tool} non è stato trovato",
  "error.binary_not_found.body": "Ledgerble non ha trovato «{tool}». Installalo oppure imposta il percorso nelle Opzioni.",
  "error.binary_not_found.action": "Apri Opzioni",
  "error.parse_error.body": "Impossibile leggere questo diario: {message}",
```

`locales/ja.json`:
```json
  "settings.hledger_command": "HLedger コマンド",
  "settings.hledger_command.help": "hledger モードで仕訳帳ファイルを解析するコマンド<br>絶対パスを指定するか、PATH に含める必要があります",
  "error.binary_not_found.title": "{tool} が見つかりません",
  "error.binary_not_found.body": "Ledgerble は「{tool}」を見つけられませんでした。インストールするか、オプションでパスを設定してください。",
  "error.binary_not_found.action": "オプションを開く",
  "error.parse_error.body": "この仕訳帳を読み込めませんでした: {message}",
```

`locales/ko.json`:
```json
  "settings.hledger_command": "HLedger 명령",
  "settings.hledger_command.help": "hledger 모드에서 저널 파일을 분석하는 데 사용하는 명령<br>절대 경로이거나 PATH에 있어야 합니다",
  "error.binary_not_found.title": "{tool}을(를) 찾을 수 없습니다",
  "error.binary_not_found.body": "Ledgerble이 “{tool}”을(를) 찾지 못했습니다. 설치하거나 옵션에서 경로를 설정하세요.",
  "error.binary_not_found.action": "옵션 열기",
  "error.parse_error.body": "이 저널을 읽을 수 없습니다: {message}",
```

`locales/nl.json`:
```json
  "settings.hledger_command": "HLedger-opdracht",
  "settings.hledger_command.help": "De opdracht om je journaalbestanden in hledger-modus te verwerken<br>Dit moet een absoluut pad zijn of in het PATH staan",
  "error.binary_not_found.title": "{tool} niet gevonden",
  "error.binary_not_found.body": "Ledgerble kon “{tool}” niet vinden. Installeer het of stel het pad in bij Opties.",
  "error.binary_not_found.action": "Opties openen",
  "error.parse_error.body": "Kon dit journaal niet lezen: {message}",
```

`locales/pl.json`:
```json
  "settings.hledger_command": "Polecenie HLedger",
  "settings.hledger_command.help": "Polecenie używane do analizy plików dziennika w trybie hledger<br>Musi to być ścieżka bezwzględna lub w PATH",
  "error.binary_not_found.title": "Nie znaleziono {tool}",
  "error.binary_not_found.body": "Ledgerble nie mógł znaleźć „{tool}”. Zainstaluj go lub ustaw ścieżkę w Opcjach.",
  "error.binary_not_found.action": "Otwórz Opcje",
  "error.parse_error.body": "Nie można odczytać tego dziennika: {message}",
```

`locales/pt.json`:
```json
  "settings.hledger_command": "Comando do HLedger",
  "settings.hledger_command.help": "O comando usado para analisar seus arquivos de diário no modo hledger<br>Deve ser um caminho absoluto ou estar no PATH",
  "error.binary_not_found.title": "{tool} não foi encontrado",
  "error.binary_not_found.body": "O Ledgerble não encontrou “{tool}”. Instale-o ou defina o caminho em Opções.",
  "error.binary_not_found.action": "Abrir Opções",
  "error.parse_error.body": "Não foi possível ler este diário: {message}",
```

`locales/ru.json`:
```json
  "settings.hledger_command": "Команда HLedger",
  "settings.hledger_command.help": "Команда для разбора файлов журнала в режиме hledger<br>Это должен быть абсолютный путь или путь в PATH",
  "error.binary_not_found.title": "{tool} не найден",
  "error.binary_not_found.body": "Ledgerble не удалось найти «{tool}». Установите его или укажите путь в Параметрах.",
  "error.binary_not_found.action": "Открыть параметры",
  "error.parse_error.body": "Не удалось прочитать этот журнал: {message}",
```

`locales/zh-CN.json`:
```json
  "settings.hledger_command": "HLedger 命令",
  "settings.hledger_command.help": "用于在 hledger 模式下解析日记账文件的命令<br>必须是绝对路径或位于 PATH 中",
  "error.binary_not_found.title": "未找到 {tool}",
  "error.binary_not_found.body": "Ledgerble 找不到“{tool}”。请安装它，或在选项中设置其路径。",
  "error.binary_not_found.action": "打开选项",
  "error.parse_error.body": "无法读取此日记账：{message}",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/i18n-binary-keys.test.js`
Expected: PASS for all 12 locale files.

- [ ] **Step 5: Commit**

```bash
git add locales/*.json test/i18n-binary-keys.test.js
git commit -m "feat: i18n-Keys für hledger-Befehl & Binary-Fehlerhinweis (12 Sprachen)"
```

---

## Task 6: `main.js` — Resolver beim Start + Fehlerklassifizierung

**Files:**
- Modify: `main.js:11-13` (requires), `main.js:28-32` (nach `settings.init`), `main.js:136-159` (`parse`)

> No new unit test here: the resolver and classifier are already covered (Tasks 1–3); `main.js` only wires them with real `execSync`/`os`/`settings`. `test/main.handlers.test.js` must still pass (it mocks electron + settings-store), which verifies `main.js` still imports cleanly.

- [ ] **Step 1: Add requires**

In `main.js`, after the `const { KNOWN_KEYS } = require('./knownKeys')` line (≈13), add:

```js
const os = require('os')
const { resolveBinaries } = require('./binaryResolver')
const { classifyParseError } = require('./parseError')
```

- [ ] **Step 2: Resolve binaries right after `settings.init({...})`**

Directly after the `settings.init({ ... })` call (the block ending around line 32), add:

```js
// Resolve ledger/hledger binaries once at startup. GUI apps launched from the
// Dock/Finder/Start menu don't inherit the shell PATH, so the bare "ledger"
// default often fails even when the binary is installed (e.g. Homebrew in
// /opt/homebrew/bin). Probe well-known locations and persist what we find so
// the renderer and the Options UI see the real path.
try {
  resolveBinaries({
    platform: process.platform,
    homedir: os.homedir(),
    canRun: (cmd) => {
      try {
        execSync('"' + cmd + '" --version', { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    },
    getSetting: (k, d) => settings.value(k, d),
    setSetting: (k, v) => settings.setValue(k, v),
  });
} catch (e) {
  console.log('binary resolution failed', e);
}
```

- [ ] **Step 3: Classify errors in `parse()`**

In `main.js`, replace the `catch (t)` block of `parse()` (lines ≈151-158):

```js
  } catch (t) {
    console.log('couldnt parse', file, t)
    event.reply(
      'parsed',
      file,
      null,
      "error:" + t);
  }
```

with:

```js
  } catch (t) {
    console.log('couldnt parse', file, t)
    const tool = hledger ? 'hledger' : 'ledger';
    event.reply('parsed', file, null, classifyParseError(t, tool));
  }
```

- [ ] **Step 4: Run the suite**

Run: `npx jest test/main.handlers.test.js`
Expected: PASS (main.js still imports and registers handlers cleanly).

- [ ] **Step 5: Commit**

```bash
git add main.js
git commit -m "feat: ledger/hledger beim Start auflösen + Parse-Fehler typisieren"
```

---

## Task 7: `src/app/Shell.jsx` — Befehlswahl ledger/hledger

**Files:**
- Modify: `src/app/Shell.jsx:30-39` (`SETTINGS_DEFAULTS`), `:451-453` (mount parse), `:467-470` (`parseFile`)
- Test: `test/Shell.commandPick.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
/** @jest-environment jsdom */
import { render, act } from '@testing-library/react';
jest.mock('echarts', () => ({ init: () => ({ setOption(){}, resize(){}, dispose(){}, on(){} }) }));
import { Shell } from '../src/app/Shell';

function setup(settings) {
  const calls = [];
  window.api = {
    onParsed: () => {},
    parse: (cmd, hledger, file) => calls.push({ cmd, hledger, file }),
    settings: {
      getAll: async () => settings,
      get: async (k) => (k === 'files.list' ? ['/j.journal'] : []),
      set: () => {},
    },
    windowControls: { minimize(){}, maximize(){}, close(){} },
    platform: 'darwin',
  };
  return calls;
}

test('uses ledger command when hledger flag is off', async () => {
  const calls = setup({ 'options.ledger.command': '/p/ledger', 'options.hledger': false });
  await act(async () => { render(<Shell />); });
  await act(async () => {});
  expect(calls).toContainEqual({ cmd: '/p/ledger', hledger: false, file: '/j.journal' });
});

test('uses hledger command when hledger flag is on', async () => {
  const calls = setup({ 'options.hledger.command': '/p/hledger', 'options.hledger': true });
  await act(async () => { render(<Shell />); });
  await act(async () => {});
  expect(calls).toContainEqual({ cmd: '/p/hledger', hledger: true, file: '/j.journal' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/Shell.commandPick.test.jsx`
Expected: FAIL — second test gets `cmd: undefined` (hledger path not selected yet).

- [ ] **Step 3a: Add the hledger.command default**

In `src/app/Shell.jsx`, in `SETTINGS_DEFAULTS`, add under the `options.hledger` line:

```js
  'options.ledger.command':  'ledger',
  'options.hledger':         false,
  'options.hledger.command': 'hledger',
```

- [ ] **Step 3b: Add a command picker and use it at both call sites**

In `Shell` (the main component), just before the `// ── Load persisted file list on mount ──` comment, add:

```js
  // ledger vs hledger binary, chosen by the hledger mode flag.
  const ledgerCommand = () =>
    getSetting('options.hledger')
      ? getSetting('options.hledger.command')
      : getSetting('options.ledger.command');
```

Replace the mount-time parse block (≈451-453):

```js
          const cmd = getSetting('options.ledger.command');
          const hledger = getSetting('options.hledger');
          window.api.parse(cmd, hledger, path);
```

with:

```js
          window.api.parse(ledgerCommand(), getSetting('options.hledger'), path);
```

Replace the `parseFile` body (≈469):

```js
      window.api.parse(getSetting('options.ledger.command'), getSetting('options.hledger'), path);
```

with:

```js
      window.api.parse(ledgerCommand(), getSetting('options.hledger'), path);
```

- [ ] **Step 4: Run test + rebundle check**

Run: `npx jest test/Shell.commandPick.test.jsx test/Shell.test.jsx`
Expected: PASS (both new tests + existing Shell tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/Shell.jsx test/Shell.commandPick.test.jsx
git commit -m "feat: Renderer wählt hledger-Befehl im hledger-Modus"
```

---

## Task 8: `src/app/Shell.jsx` — Fehler-Banner

**Files:**
- Modify: `src/app/Shell.jsx` (main-pane, nach dem pane-header, vor `{/* content + inspector */}`)
- Test: `test/Shell.errorBanner.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
/** @jest-environment jsdom */
import { render, act, screen, fireEvent } from '@testing-library/react';
jest.mock('echarts', () => ({ init: () => ({ setOption(){}, resize(){}, dispose(){}, on(){} }) }));
import { Shell } from '../src/app/Shell';

let parsedCb;
beforeEach(() => {
  parsedCb = null;
  window.api = {
    onParsed: (cb) => { parsedCb = cb; },
    parse: () => {},
    settings: { getAll: async () => ({}), get: async () => [], set: () => {} },
    windowControls: { minimize(){}, maximize(){}, close(){} },
    platform: 'darwin',
  };
});

test('shows a binary-not-found banner with the tool name', async () => {
  await act(async () => { render(<Shell />); });
  await act(async () => {
    parsedCb('/j.journal', null, { type: 'binary-not-found', tool: 'ledger', message: 'ENOENT' });
  });
  expect(screen.getByText('ledger was not found')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open Options' })).toBeInTheDocument();
});

test('clicking the action opens the Options view', async () => {
  await act(async () => { render(<Shell />); });
  await act(async () => {
    parsedCb('/j.journal', null, { type: 'binary-not-found', tool: 'hledger', message: 'ENOENT' });
  });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open Options' })); });
  // Options view subtitle proves we navigated there.
  expect(screen.getByText('Preferences')).toBeInTheDocument();
});

test('shows a parse-error banner with the message', async () => {
  await act(async () => { render(<Shell />); });
  await act(async () => {
    parsedCb('/j.journal', null, { type: 'parse-error', message: 'Too few fields' });
  });
  expect(screen.getByText(/Too few fields/)).toBeInTheDocument();
});
```

> Note: `'Preferences'` is the value of `subtitle.preferences` in `locales/en.json`. If that string differs, match the actual value.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/Shell.errorBanner.test.jsx`
Expected: FAIL — banner text not found.

- [ ] **Step 3a: Add an `ErrorBanner` component**

In `src/app/Shell.jsx`, near the other small components (e.g. just above the `JournalFooter` function), add:

```jsx
function ErrorBanner({ errors, onOpenOptions }) {
  if (!errors || errors.length === 0) return null;
  return (
    <div className="chrome-print-hide" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 22px', flexShrink: 0 }}>
      {errors.map(({ path, error }) => {
        const isMissing = error.type === 'binary-not-found';
        const title = isMissing
          ? t('error.binary_not_found.title').replace('{tool}', error.tool)
          : baseName(path);
        const body = isMissing
          ? t('error.binary_not_found.body').replace('{tool}', error.tool)
          : t('error.parse_error.body').replace('{message}', error.message || '');
        return (
          <div key={path} role="alert" style={{
            border: `1px solid ${T.line2}`, borderLeft: `3px solid ${T.rust || '#b3541e'}`,
            background: T.surface, borderRadius: 8, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, fontFamily: T.sans }}>{title}</div>
              <div style={{ fontSize: 12.5, color: T.ink2, fontFamily: T.sans, marginTop: 2 }}>{body}</div>
            </div>
            {isMissing && (
              <button onClick={onOpenOptions} style={{
                flexShrink: 0, fontFamily: T.sans, fontSize: 12.5, fontWeight: 500,
                padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
                border: `1px solid ${T.pine}`, background: T.pineSoft, color: T.pineStrong,
              }}>{t('error.binary_not_found.action')}</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

> `baseName` is the helper already defined in `Shell.jsx` (used by `JournalFooter`). If it is scoped inside another function, lift it to module scope or inline `path.split('/').pop().split('\\').pop()`.

- [ ] **Step 3b: Derive the error list and render the banner**

In the `Shell` component, after `activeFiles` is computed (the `useMemo` ending ≈417), add:

```js
  const fileErrors = useMemo(
    () => Array.from(s.files.entries())
      .filter(([, st]) => st && st.error)
      .map(([path, st]) => ({ path, error: st.error })),
    [s.files]
  );
```

In the JSX, in the main-pane, immediately **after** the closing `</div>` of the pane-header block and **before** the `{/* content + inspector */}` comment, insert:

```jsx
              <ErrorBanner errors={fileErrors} onOpenOptions={() => setView('options')} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/Shell.errorBanner.test.jsx`
Expected: PASS (banner text, action button, navigation, parse-error message).

- [ ] **Step 5: Commit**

```bash
git add src/app/Shell.jsx test/Shell.errorBanner.test.jsx
git commit -m "feat: Fehler-Banner für nicht gefundenes Binary & Parse-Fehler"
```

---

## Task 9: Gesamtlauf + Bundle

**Files:** none (verification only)

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS, keine offenen Failures. Falls `options.test.js` an der Anzahl der Settings hängt: Zahl auf den neuen Stand bringen.

- [ ] **Step 2: Re-bundle the renderer (renderer changes only take effect bundled)**

Run: `npm run bundle`
Expected: esbuild schreibt `dist/bundle.js` ohne Fehler.

- [ ] **Step 3: Commit (falls bundle versioniert ist)**

```bash
git status --porcelain dist/bundle.js
# Nur committen, wenn dist/bundle.js versioniert ist:
git add dist/bundle.js 2>/dev/null && git commit -m "chore: Renderer-Bundle aktualisiert" || true
```

---

## Self-Review

**Spec coverage:**
- Auto-Erkennung beider Binaries, plattformspezifisch → Tasks 1, 2, 6. ✔
- hledger als vollwertige Option (eigener Befehl, Erkennung) → Tasks 2, 4, 7. ✔
- macOS/Linux/Windows-Kandidatenlisten inkl. `.exe`, home-relativ → Task 1. ✔
- Persistieren des gefundenen Pfads (in Settings sichtbar/editierbar) → Tasks 2, 4, 6. ✔
- Fehler typisieren (`binary-not-found` mit `tool`, `parse-error`), inkl. Windows „is not recognized" → Tasks 3, 6. ✔
- Hinweis-Banner mit Anleitung + Button zu den Optionen; Parse-Fehler ebenfalls sichtbar → Task 8. ✔
- i18n in allen 12 Locales → Task 5. ✔
- knownKeys-Ergänzung → Task 4. ✔
- Eine Wahrheitsquelle statt divergierender Defaults: persistierter Resolver-Wert gewinnt, Shell-Default nur Fallback → Tasks 6, 7. ✔

**Placeholder scan:** Keine TBD/TODO; jeder Codeschritt enthält vollständigen Code, jede i18n-Zeichenkette ist real.

**Type consistency:** `findBinary(binary, configuredCmd, {platform, homedir, canRun})` und `resolveBinaries({platform, homedir, canRun, getSetting, setSetting})` konsistent über Tasks 1/2/6. Fehlerobjekt `{type, tool?, message}` konsistent in `classifyParseError` (Task 3), IPC-Reply (Task 6) und Banner (Task 8). Settings-Key `options.hledger.command` identisch in Tasks 2/4/7.
