// Shell.jsx — Quiet Ledger platform-adaptive window chrome, ported from rd-shell.jsx
// Adaptations applied:
//   (a) platform from window.api.platform
//   (b) no useTweaks / TweaksPanel
//   (c) netColor hardcoded '#7A47C2'; catRule read from persisted settings via getSetting
//   (d) inspector account tree wired to model.accountTree (Task 3.6)
//   (e) OverviewView wired to live data via compute + buildOverview (Task 3.6)
//   (f) OptionsView wired via setSetting which updates React state + persists (Task 6.4)
import React, { useState, useEffect, useMemo } from 'react';
import { useAppState } from '../store/useAppState';
import { T, money, kfmt } from '../ui/tokens';
const { t, loadLocale, detectLocale, formatIntervalLabel } = require('../../i18n');
import { Icon } from '../ui/Icon';
import { Segmented, Eyebrow, Num, MenuSelect, SearchField, DateRangeSlider } from '../ui/controls';
import { makeTypeExtractor } from '../data/typeExtractor';
import { compute } from '../data/compute';
const { isDeselectedDeep, toggleAccountInDesel } = require('../data/accountTree');
const { findRedundantFiles } = require('../data/redundancy');
import { buildOverview, buildBreakdownTree, buildBalanceTree, buildAssets, buildAssetAccountList, buildPortfolio, buildPostings } from '../data/adapters';
import { OverviewView } from '../views/OverviewView';
import { ExpensesIncomeView } from '../views/ExpensesIncomeView';
import { BalanceView } from '../views/BalanceView';
import { AssetsView } from '../views/AssetsView';
import { PortfolioView } from '../views/PortfolioView';
import { PostingsView } from '../views/PostingsView';
import { OptionsView } from '../views/OptionsView';

// ── Minimal settings defaults (mirrors allSettings in options.js) ────────────
const SETTINGS_DEFAULTS = {
  'options.ledger.command':  'ledger',
  'options.hledger':         false,
  'options.expenses.regex':  '^expenses?(:|$)',
  'options.income.regex':    '^(income|revenue)s?(:|$)',
  'options.assets.regex':    '^assets?(:|$)',
  'options.liabilities.regex': '^(debts?|liabilit(y|ies))(:|$)',
  'options.equity.regex':    '^equity(:|$)',
  'options.overview.catRule': 'top5',
  'options.locale':          'auto',
};

function defaultLedgerCommand() {
  const plat = window.api && window.api.platform;
  if (plat === 'darwin') return '/opt/homebrew/bin/ledger';
  if (plat === 'linux') return '/usr/bin/ledger';
  return 'ledger';
}

function makeGetSetting(cache) {
  return (key) => {
    const val = cache[key];
    if (val !== undefined) return val;
    if (key === 'options.ledger.command') return defaultLedgerCommand();
    return SETTINGS_DEFAULTS[key];
  };
}

const FONT_STACK = {
  mac: {
    sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
    mono: 'ui-monospace, "SF Mono", "SFMono-Regular", Menlo, "Cascadia Code", monospace',
  },
  win: {
    sans: '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
    mono: '"Cascadia Code", "Cascadia Mono", Consolas, ui-monospace, monospace',
  },
};

const NAV = [
  { groupKey: 'nav.reports', group: 'Reports', items: [
    { id: 'overview',  labelKey: 'nav.overview',  icon: 'overview'  },
    { id: 'balance',   labelKey: 'tab.balance',   icon: 'balance'   },
    { id: 'expenses',  labelKey: 'tab.expenses',  icon: 'expenses'  },
    { id: 'income',    labelKey: 'tab.income',    icon: 'income'    },
    { id: 'assets',    labelKey: 'nav.assets',    icon: 'assets'    },
    { id: 'portfolio', labelKey: 'tab.portfolio', icon: 'portfolio' },
  ]},
  { groupKey: 'nav.ledger', group: 'Ledger', items: [
    { id: 'postings',  labelKey: 'tab.postings',  icon: 'postings'  },
  ]},
];

const TITLE_KEYS = {
  overview:  'nav.overview',
  balance:   'tab.balance',
  expenses:  'tab.expenses',
  income:    'tab.income',
  assets:    'nav.assets',
  portfolio: 'tab.portfolio',
  postings:  'tab.postings',
  options:   'nav.options',
};

const FILTER_TABS = new Set(['overview', 'balance', 'expenses', 'income', 'assets', 'portfolio', 'postings']);
const PERIOD_TABS = new Set(['overview', 'balance', 'expenses', 'income', 'assets', 'portfolio']);

// ── window controls ──────────────────────────────────────────
function WinControls() {
  const [hov, setHov] = useState(null);
  const base = { width: 46, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', transition: 'background 100ms' };
  const ico = (name) => {
    if (name === 'min') return <svg width="11" height="11" viewBox="0 0 11 11"><line x1="1" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1" /></svg>;
    if (name === 'max') return <svg width="11" height="11" viewBox="0 0 11 11"><rect x="1.5" y="1.5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" /></svg>;
    return <svg width="11" height="11" viewBox="0 0 11 11"><line x1="1.5" y1="1.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1" /><line x1="9.5" y1="1.5" x2="1.5" y2="9.5" stroke="currentColor" strokeWidth="1" /></svg>;
  };
  const controls = window.api && window.api.windowControls ? window.api.windowControls : { minimize() {}, maximize() {}, close() {} };
  const actions = { min: () => controls.minimize(), max: () => controls.maximize(), close: () => controls.close() };
  return (
    <div data-testid="win-controls" style={{ display: 'flex', alignSelf: 'stretch' }}>
      {['min', 'max', 'close'].map(n => (
        <div key={n} onMouseEnter={() => setHov(n)} onMouseLeave={() => setHov(null)} onClick={actions[n]}
          style={{ ...base, background: hov === n ? (n === 'close' ? '#E81123' : 'rgba(16,18,22,0.07)') : 'transparent', color: hov === n && n === 'close' ? '#fff' : T.ink2 }}>
          {ico(n)}
        </div>
      ))}
    </div>
  );
}

// Flatten a nested account-tree object into a sorted list of "Root:Child" strings.
function flattenAccountTree(tree, prefix, out) {
  if (!tree || typeof tree !== 'object') return;
  for (const key of Object.keys(tree).sort()) {
    const fullPath = prefix ? prefix + ':' + key : key;
    out.push(fullPath);
    flattenAccountTree(tree[key], fullPath, out);
  }
}

// ── collapsible account tree node ────────────────────────────
function AccountTreeNode({ name, fullPath, children, desel, onToggle, depth }) {
  const hasChildren = children && Object.keys(children).length > 0;
  const [expanded, setExpanded] = useState(depth === 0);

  // True if visible (neither self nor any ancestor is in desel)
  const visible = !isDeselectedDeep(fullPath, desel);
  // Indeterminate: visible itself but at least one child is hidden
  const someChildHidden = hasChildren && Object.keys(children).some(
    child => isDeselectedDeep(fullPath + ':' + child, desel)
  );
  const indeterminate = visible && someChildHidden;

  const cbRef = React.useRef(null);
  React.useEffect(() => {
    if (cbRef.current) cbRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', paddingLeft: depth * 14 }}>
        {hasChildren ? (
          <button onClick={() => setExpanded(e => !e)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: T.ink3, display: 'flex', width: 14, flexShrink: 0 }}>
            <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }}>
              <path d="M3 2 L7 5 L3 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1, minWidth: 0 }}>
          <input ref={cbRef} type="checkbox" checked={visible} onChange={() => onToggle(fullPath)}
            style={{ accentColor: T.pine, width: 13, height: 13, flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, fontFamily: T.sans, color: visible ? T.ink2 : T.ink4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
        </label>
      </div>
      {hasChildren && expanded && (
        <div>
          {Object.keys(children).sort().map(child => (
            <AccountTreeNode
              key={child}
              name={child}
              fullPath={fullPath + ':' + child}
              children={children[child]}
              desel={desel}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── account filter tree (inspector) ──────────────────────────
function Inspector({ desel, onToggle, onAll, onNone, onClose, accountTree, intervals, sliderValues, onRangeChange }) {
  const flat = [];
  if (accountTree && typeof accountTree === 'object' && !Array.isArray(accountTree)) {
    flattenAccountTree(accountTree, '', flat);
  }
  const total = flat.length;
  const active = flat.filter(p => !isDeselectedDeep(p, desel)).length;
  const ghost = { fontFamily: T.sans, fontSize: 11.5, fontWeight: 500, padding: '4px 10px', borderRadius: 6, border: `1px solid ${T.line2}`, background: T.surface, color: T.ink2, cursor: 'pointer' };

  const rootKeys = accountTree && typeof accountTree === 'object'
    ? Object.keys(accountTree).sort()
    : [];

  return (
    <div style={{ width: 248, flexShrink: 0, borderLeft: `1px solid ${T.line}`, background: T.surface, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: `1px solid ${T.line}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: T.sans }}>{t('filter.filters')}</span>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.ink3, padding: 2, display: 'flex' }}><Icon name="sliders" size={15} /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        <Eyebrow style={{ marginBottom: 9 }}>{t('filter.date_range')}</Eyebrow>
        <DateRangeSlider intervals={intervals || []} value={sliderValues || [0, 0]} onChange={onRangeChange} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
          <Eyebrow>{t('filter.accounts')}</Eyebrow>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={ghost} onClick={onAll}>{t('filter.all')}</button>
            <button style={ghost} onClick={onNone}>{t('filter.none')}</button>
          </div>
        </div>
        {rootKeys.map(key => (
          <AccountTreeNode
            key={key}
            name={key}
            fullPath={key}
            children={accountTree[key]}
            desel={desel}
            onToggle={onToggle}
            depth={0}
          />
        ))}
      </div>
      <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.line}`, fontSize: 11.5, color: T.ink3, fontFamily: T.sans }}>
        {t('filter.showing_x_of_y').replace('{active}', active).replace('{total}', total)}
      </div>
    </div>
  );
}

// ── nav sidebar ──────────────────────────────────────────────
function NavItem({ item, active, onClick }) {
  return (
    <button onClick={onClick} className={active ? '' : 'rd-nav'} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 10px', borderRadius: 8,
      border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: T.sans, fontSize: 13,
      fontWeight: active ? 560 : 450, color: active ? T.ink : T.ink2,
      background: active ? T.pineSoft : 'transparent', transition: 'background 120ms, color 120ms',
    }}>
      <span style={{ color: active ? T.pine : T.ink3, display: 'flex' }}><Icon name={item.icon} size={17} sw={1.6} /></span>
      {item.labelKey ? t(item.labelKey) : item.label}
    </button>
  );
}

// ── journal file menu (bottom-left) ──────────────────────────
const baseName = (f) => f.split('/').pop().split('\\').pop();

// Small square icon button used in the journal panel rows.
function RowAction({ testid, label, icon, color, onClick }) {
  return (
    <button
      data-testid={testid}
      title={label}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="rd-menu"
      style={{ border: 'none', background: 'none', cursor: 'pointer', color: color || T.ink3, padding: 3, borderRadius: 5, display: 'flex' }}
    >
      <Icon name={icon} size={14} stroke={color || T.ink3} />
    </button>
  );
}

// Recursively render the include tree for one journal file. Included files are
// read-only (they live inside their parent on disk) but can be revealed.
function IncludeRows({ nodes, depth, onReveal }) {
  return nodes.map((n) => (
    <React.Fragment key={n.path}>
      <div className="rd-row" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: `3px 10px 3px ${12 + depth * 16}px`, borderRadius: 6 }}>
        <Icon name="cornerDownRight" size={13} stroke={T.ink4} />
        <span style={{ flex: 1, fontFamily: T.sans, fontSize: 11.5, color: T.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{baseName(n.path)}</span>
        <RowAction testid={`reveal:${n.path}`} label={t('file.reveal')} icon="overview" onClick={() => onReveal && onReveal(n.path)} />
      </div>
      {n.includes.length > 0 && <IncludeRows nodes={n.includes} depth={depth + 1} onReveal={onReveal} />}
    </React.Fragment>
  ));
}

function JournalFooter({ files, includesByFile, redundantPaths, onOpen, onReload, onReveal, onRemove }) {
  const [open, setOpen] = useState(false);
  const includes = includesByFile || {};
  const redundant = redundantPaths || new Set();
  const basenames = files.map(baseName);

  const item = { padding: '7px 12px', fontSize: 12.5, fontFamily: T.sans, color: T.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, whiteSpace: 'nowrap' };
  const close = (fn) => () => { setOpen(false); fn && fn(); };
  const menu = (
    <>
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, minWidth: 230, maxHeight: 360, overflowY: 'auto', zIndex: 41, background: T.surface, border: `1px solid ${T.line2}`, borderRadius: 9, padding: '5px', boxShadow: '0 12px 30px -8px rgba(16,18,22,0.30), 0 0 0 0.5px rgba(16,18,22,0.06)' }}>
        {files.map((f) => {
          const isRedundant = redundant.has(f);
          return (
          <React.Fragment key={f}>
            <div className="rd-row" data-testid={`file-row:${f}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isRedundant ? T.ink4 : T.pos, flexShrink: 0 }} />
              <span style={{ flex: 1, fontFamily: T.sans, fontSize: 12.5, color: isRedundant ? T.ink3 : T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{baseName(f)}</span>
              {isRedundant && <span title={t('file.included_hint')} style={{ fontFamily: T.sans, fontSize: 10.5, color: T.ink4, whiteSpace: 'nowrap' }}>{t('file.included_hint')}</span>}
              <RowAction testid={`reveal:${f}`} label={t('file.reveal')} icon="overview" onClick={() => onReveal && onReveal(f)} />
              <RowAction testid={`remove:${f}`} label={t('file.remove')} icon="close" color={T.neg} onClick={() => onRemove && onRemove(f)} />
            </div>
            {(includes[f] || []).length > 0 && <IncludeRows nodes={includes[f]} depth={1} onReveal={onReveal} />}
          </React.Fragment>
          );
        })}
        <div style={{ height: 1, background: T.line, margin: '4px 6px' }} />
        <div data-testid="journal-open" className="rd-menu" style={{ ...item, borderRadius: 6 }} onClick={close(onOpen)}><Icon name="files" size={15} stroke={T.ink3} /> {t('file.open')}</div>
        <div data-testid="journal-reload" className="rd-menu" style={{ ...item, borderRadius: 6 }} onClick={close(onReload)}><Icon name="reload" size={15} stroke={T.ink3} /> {t('file.reload')}</div>
      </div>
    </>
  );
  return (
    <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 8, position: 'relative' }}>
      {files.length === 0 ? (
        <button data-testid="journal-open-empty" onClick={onOpen} className="rd-nav" style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px dashed ${T.line2}`, background: 'transparent', cursor: 'pointer', fontFamily: T.sans, fontSize: 12.5, color: T.ink2 }}>
          <Icon name="files" size={15} stroke={T.ink3} /> {t('file.open_ledger')}
        </button>
      ) : (
        <div data-testid="journal-menu-trigger" className="rd-nav" onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, cursor: 'pointer' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.pos, flexShrink: 0 }} />
          <Num color={T.ink2} size={11.5} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{basenames[0]}{basenames.length > 1 ? ` +${basenames.length - 1}` : ''}</Num>
          <span style={{ display: 'flex', color: T.ink3 }}><Icon name="options" size={15} /></span>
        </div>
      )}
      {open && menu}
    </div>
  );
}

// ── File menu (clickable, both platforms) ────────────────────
function FileMenu({ mod, onPrint, itemStyle }) {
  const [open, setOpen] = useState(false);
  const row = { padding: '6px 12px', fontSize: 13, fontFamily: T.sans, color: T.ink, cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 28, borderRadius: 6, whiteSpace: 'nowrap' };
  const acc = { color: T.ink4, fontFamily: T.sans, fontSize: 12 };
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <span className="rd-menu" style={{ ...itemStyle, background: open ? 'rgba(16,18,22,0.08)' : undefined }} onClick={() => setOpen(o => !o)}>{t('menu.file')}</span>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 210, zIndex: 61, background: T.surface, border: `1px solid ${T.line2}`, borderRadius: 9, padding: 5, boxShadow: '0 14px 34px -8px rgba(16,18,22,0.32), 0 0 0 0.5px rgba(16,18,22,0.06)' }}>
            <div className="rd-menu" style={row} onClick={() => setOpen(false)}>{t('file.open')} <span style={acc}>{mod}O</span></div>
            <div className="rd-menu" style={row} onClick={() => setOpen(false)}>{t('file.reload')} <span style={acc}>{mod}R</span></div>
            <div style={{ height: 1, background: T.line, margin: '4px 6px' }} />
            <div className="rd-menu" style={row} onClick={() => { setOpen(false); onPrint(); }}>{t('file.print')} <span style={acc}>{mod}P</span></div>
            <div className="rd-menu" style={row} onClick={() => { setOpen(false); onPrint(); }}>{t('file.print_pdf')}</div>
          </div>
        </>
      )}
    </span>
  );
}

// ── Shell ────────────────────────────────────────────────────
function Shell() {
  const plat = (window.api && window.api.platform === 'win32') ? 'win' : 'mac';
  const netColor = '#7A47C2';

  const s = useAppState();
  const { view, setView, currency: cur, setCurrency: setCur, period, setPeriod,
          deselectedAccounts: desel, setDeselected,
          deselectedAssetAccounts: deselAssets, setDeselectedAssets,
          inspectorOpen: insp, setInspectorOpen: setInsp,
          query, setQuery, postingType: typeF, setPostingType: setTypeF } = s;

  // ── Settings cache ───────────────────────────────────────────────────────
  const [settingsCache, setSettingsCache] = useState({});
  useEffect(() => {
    if (window.api && window.api.settings && window.api.settings.getAll) {
      window.api.settings.getAll().then(cache => {
        if (cache && typeof cache === 'object') {
          const saved = cache['options.locale'] || 'auto';
          const effective = saved === 'auto' ? detectLocale(navigator.language || 'en') : saved;
          loadLocale(effective);
          setSettingsCache(cache);
        }
      }).catch(() => {});
    }
  }, []);

  const getSetting = useMemo(() => makeGetSetting(settingsCache), [settingsCache]);
  const typeExtractor = useMemo(() => makeTypeExtractor(getSetting), [getSetting]);

  // ── Include trees + redundant-file detection ──────────────────────────────
  // A ledger file can `include` others. If the user ALSO loads an included file
  // on its own, its postings would be merged twice → doubled values. We resolve
  // each loaded file's include tree and drop files already pulled in elsewhere.
  const [includesByFile, setIncludesByFile] = useState({});
  const fileKey = Array.from(s.files.keys()).join('\n');
  useEffect(() => {
    if (!window.api || !window.api.getIncludes) return;
    const paths = Array.from(s.files.keys());
    let cancelled = false;
    Promise.all(paths.map((p) => window.api.getIncludes(p).then((tree) => [p, tree]).catch(() => [p, []])))
      .then((pairs) => { if (!cancelled) setIncludesByFile(Object.fromEntries(pairs)); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKey]);

  const redundantPaths = useMemo(
    () => findRedundantFiles(Array.from(s.files.keys()), includesByFile),
    [fileKey, includesByFile] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Files actually fed to compute(): loaded files minus those already included
  // (transitively) by another loaded file.
  const activeFiles = useMemo(() => {
    if (redundantPaths.size === 0) return s.files;
    return new Map(Array.from(s.files).filter(([p]) => !redundantPaths.has(p)));
  }, [s.files, redundantPaths]);

  // setSetting: persists to main process AND updates React cache so all views re-render.
  const setSetting = (key, value) => {
    if (key === 'options.locale') {
      const effective = value === 'auto' ? detectLocale(navigator.language || 'en') : value;
      loadLocale(effective);
    }
    setSettingsCache(prev => ({ ...prev, [key]: value }));
    if (window.api && window.api.settings && window.api.settings.set) {
      window.api.settings.set(key, value);
    }
  };

  // ── Compute model ────────────────────────────────────────────────────────
  const model = useMemo(
    () => compute({
      files: activeFiles,
      currency: s.currency,
      period: s.period,
      deselectedAccounts: s.deselectedAccounts,
      dateRange: s.dateRange,
      typeExtractor,
    }),
    [activeFiles, s.currency, s.period, s.deselectedAccounts, s.dateRange, typeExtractor]
  );

  // ── Load persisted file list on mount ────────────────────────────────────
  useEffect(() => {
    if (!window.api || !window.api.settings || !window.api.settings.get) return;
    window.api.settings.get('files.list', []).then(filesList => {
      if (!Array.isArray(filesList)) return;
      for (const path of filesList) {
        if (window.api.parse) {
          const cmd = getSetting('options.ledger.command');
          const hledger = getSetting('options.hledger');
          window.api.parse(cmd, hledger, path);
        }
      }
    }).catch(() => {});
  // Run once on mount — getSetting ref will be stable on first render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Journal file actions (footer menu) ───────────────────────────────────
  const persistFileList = (paths) => {
    if (window.api && window.api.settings && window.api.settings.set) {
      window.api.settings.set('files.list', paths);
    }
  };
  const parseFile = (path) => {
    if (window.api && window.api.parse) {
      window.api.parse(getSetting('options.ledger.command'), getSetting('options.hledger'), path);
    }
  };
  const handleOpenJournal = async () => {
    if (!window.api || !window.api.showOpenJournal) return;
    const picked = await window.api.showOpenJournal();
    if (!picked || s.files.has(picked)) return;
    parseFile(picked);                                  // onParsed adds it to s.files
    persistFileList([...s.files.keys(), picked]);
  };
  const handleReloadJournals = () => {
    for (const path of s.files.keys()) parseFile(path);
  };
  const handleRevealJournal = (path) => {
    if (window.api && window.api.revealFile) window.api.revealFile(path);
  };
  const handleRemoveJournal = (path) => {
    s.setFiles(prev => { const n = new Map(prev); n.delete(path); return n; });
    persistFileList(Array.from(s.files.keys()).filter(p => p !== path));
  };

  const showInsp = FILTER_TABS.has(view) && insp;

  // Build portfolio view-model once so we can read portfolioFirstKey for the
  // slider clamp AND pass the vm to PortfolioView without calling twice.
  const portfolioVm = useMemo(
    () => (view === 'portfolio' && s.files.size > 0) ? buildPortfolio(model) : null,
    [view, s.files.size, model]
  );

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
    ? [
        Math.max((model.sliderValues || [0, 0])[0], portfolioMinIdx),
        Math.max((model.sliderValues || [0, 0])[1], portfolioMinIdx),
      ]
    : model.sliderValues;

  // Write-through: when the Portfolio tab becomes active and portfolioMinIdx > 0,
  // push the clamped from-index into global dateRange so all other tabs see the
  // same range instead of the raw (unclamped) sliderValues.
  useEffect(() => {
    if (view !== 'portfolio' || portfolioMinIdx <= 0) return;
    const currentFrom = (model.sliderValues || [0, 0])[0];
    if (currentFrom < portfolioMinIdx) {
      onRangeChange(portfolioMinIdx, (model.sliderValues || [0, 0])[1]);
    }
  }, [view, portfolioMinIdx]);

  // Portfolio tab only exists when stock/non-cash holdings are present (legacy
  // portfolio.js behaviour). Hide it otherwise, and bounce off it if it vanishes.
  const navGroups = NAV.map(g => ({
    ...g,
    items: g.items.filter(it => it.id !== 'portfolio' || model.hasPortfolio),
  }));
  useEffect(() => {
    if (view === 'portfolio' && !model.hasPortfolio) setView('overview');
  }, [view, model.hasPortfolio, setView]);

  // The date range is stored as dates, so it survives a granularity change —
  // the same span is simply re-mapped onto the new period's intervals.
  const onRangeChange = (from, to) => {
    const fd = model.fullIntervalDates;
    if (!fd || fd.length === 0) return;
    const lo = Math.max(0, Math.min(from, fd.length - 1));
    const hi = Math.max(0, Math.min(to, fd.length - 1));
    s.setDateRange([fd[lo].getTime(), fd[hi].getTime()]);
  };

  const onSearch = v => { setQuery(v); };

  const doPrint = () => window.print();
  useEffect(() => {
    const onKey = e => { if ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); window.print(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const subtitle = (() => {
    if (view === 'options') return t('subtitle.preferences');
    const periodLabel = t('filter.' + period.toLowerCase());
    const ivs = model.intervals || [];
    if (ivs.length === 0) {
      if (view === 'postings') return t('subtitle.all_transactions');
      if (view === 'balance') return t('subtitle.as_of_empty').replace('{period}', periodLabel);
      return periodLabel;
    }
    const fmt = (label) => formatIntervalLabel(label, period);
    const first = fmt(ivs[0]);
    const last = fmt(ivs[ivs.length - 1]);
    if (view === 'postings') return t('subtitle.all_transactions_range').replace('{first}', first).replace('{last}', last);
    if (view === 'balance') return t('subtitle.as_of_last').replace('{last}', last).replace('{period}', periodLabel);
    return t('subtitle.period_range').replace('{period}', periodLabel).replace('{first}', first).replace('{last}', last);
  })();

  const fonts = FONT_STACK[plat];

  const brand = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <img src="icons/gerbil.webp" width={20} height={20} alt="" style={{ display: 'block' }} />
      <span style={{ fontSize: 14, fontWeight: 600, color: T.ink, fontFamily: T.sans, letterSpacing: '-0.02em' }}>Ledger<span style={{ color: T.pine }}>ble</span></span>
    </div>
  );

  const macBar = (
    <div className="chrome-print-hide" style={{ display: 'flex', alignItems: 'center', height: 52, background: T.sidebar, borderBottom: `1px solid ${T.line}`, paddingLeft: 80, paddingRight: 12, flexShrink: 0, gap: 12, WebkitAppRegion: 'drag' }}>
      {brand}
      <div style={{ flex: 1 }} />
      <div style={{ WebkitAppRegion: 'no-drag' }}><SearchField query={query} onChange={onSearch} /></div>
    </div>
  );

  const winMenuItem = { padding: '3px 9px', borderRadius: 4, fontSize: 12.5, fontFamily: T.sans, color: T.ink2, cursor: 'default' };
  const winBar = (
    <div className="chrome-print-hide" style={{ flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', height: 38, background: T.sidebar, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ paddingLeft: 14, paddingRight: 10 }}>{brand}</div>
        <div style={{ flex: 1, alignSelf: 'stretch' }} />
        <WinControls />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', height: 34, background: T.surface, borderBottom: `1px solid ${T.line}`, paddingLeft: 8, paddingRight: 10, gap: 2 }}>
        <FileMenu mod="Ctrl+" onPrint={doPrint} itemStyle={winMenuItem} />
        {[{ key: 'menu.edit', label: 'Edit' }, { key: 'menu.view', label: 'View' }, { key: 'menu.help', label: 'Help' }].map(m => <span key={m.key} className="rd-menu" style={winMenuItem}>{t(m.key)}</span>)}
        <div style={{ flex: 1 }} />
        <SearchField query={query} onChange={onSearch} width={196} />
      </div>
    </div>
  );

  return (
    <div className="app-root" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.surface, '--rd-sans': fonts.sans, '--rd-mono': fonts.mono }}>
      <div className="print-card" style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {plat === 'mac' ? macBar : winBar}

          {/* ── body ── */}
          <div className="card-body" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* sidebar */}
            <nav className="chrome-print-hide" style={{ width: 224, flexShrink: 0, background: T.sidebar, borderRight: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', padding: '8px 10px' }}>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {navGroups.map(g => (
                  <div key={g.group} style={{ marginBottom: 14 }}>
                    <div style={{ padding: '4px 10px 6px' }}><Eyebrow>{t(g.groupKey)}</Eyebrow></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {g.items.map(it => <NavItem key={it.id} item={it} active={view === it.id} onClick={() => setView(it.id)} />)}
                    </div>
                  </div>
                ))}
              </div>
              {/* footer: options + journal file menu */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <NavItem item={{ id: 'options', labelKey: 'nav.options', icon: 'options' }} active={view === 'options'} onClick={() => setView('options')} />
                <JournalFooter
                  files={Array.from(s.files.keys())}
                  includesByFile={includesByFile}
                  redundantPaths={redundantPaths}
                  onOpen={handleOpenJournal}
                  onReload={handleReloadJournals}
                  onReveal={handleRevealJournal}
                  onRemove={handleRemoveJournal}
                />
              </div>
            </nav>

            {/* main pane */}
            <div className="main-pane" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.surface }}>
              {/* print-only header */}
              {(() => {
                const fileNames = s.files.size > 0
                  ? Array.from(s.files.keys()).map(f => f.split('/').pop().split('\\').pop()).join(', ')
                  : null;
                const printDate = new Date().toLocaleDateString();
                return (
                  <div id="printHeader" style={{ display: 'none', padding: '0 0 14px', marginBottom: 10, borderBottom: `1px solid ${T.line2}` }}>
                    <img className="print-logo" src="icons/gerbil.webp" alt="" />
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, fontFamily: T.sans }}>
                      {t(TITLE_KEYS[view])}{fileNames ? ` — ${fileNames}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: T.ink2, fontFamily: T.sans, marginTop: 3 }}>
                      {subtitle} · {t('print.base')} {model.currency || cur} · {t('print.printed')} {printDate}
                    </div>
                  </div>
                );
              })()}
              {/* pane header */}
              <div className="chrome-print-hide" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', borderBottom: `1px solid ${T.line}`, flexShrink: 0, background: T.surface }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 640, color: T.ink, fontFamily: T.sans, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{t(TITLE_KEYS[view])}</div>
                  <div style={{ fontSize: 12, color: T.ink3, fontFamily: T.sans, marginTop: 2 }}>{subtitle}</div>
                </div>
                <div style={{ flex: 1 }} />
                {view === 'options' ? null : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    {view === 'postings' && (
                      <Segmented options={[{ value: 'all', label: t('type.all') }, { value: 'income', label: t('stat.income') }, { value: 'expenses', label: t('stat.expenses') }, { value: 'assets', label: t('type.assets') }]} value={typeF} onChange={setTypeF} size="sm" />
                    )}
                    {PERIOD_TABS.has(view) && <MenuSelect value={period} onChange={setPeriod} options={[
                      { value: 'Daily',     label: t('filter.daily') },
                      { value: 'Weekly',    label: t('filter.weekly') },
                      { value: 'Monthly',   label: t('filter.monthly') },
                      { value: 'Quarterly', label: t('filter.quarterly') },
                      { value: 'Yearly',    label: t('filter.yearly') },
                    ]} />}
                    <MenuSelect value={model.currency || cur} onChange={setCur} options={(model.currencies && model.currencies.length > 0) ? model.currencies : ['USD', 'EUR', 'GBP']} width={76} />
                    {FILTER_TABS.has(view) && (
                      <button onClick={() => setInsp(v => !v)} title={t('filter.toggle')} style={{
                        display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.sans, fontSize: 12.5, fontWeight: 500,
                        padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
                        border: `1px solid ${showInsp ? T.pine : T.line2}`, background: showInsp ? T.pineSoft : T.surface, color: showInsp ? T.pineStrong : T.ink2,
                      }}><Icon name="sliders" size={15} stroke={showInsp ? T.pine : T.ink3} /> {t('filter.filters')}</button>
                    )}
                  </div>
                )}
              </div>

              {/* content + inspector */}
              <div className="pane-region" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div className="pane-content" style={{ flex: 1, overflow: 'hidden' }}>
                  {view === 'overview' && s.files.size > 0
                    ? <OverviewView vm={buildOverview(model)} cur={model.currency || cur} netColor={netColor} catRule={getSetting('options.overview.catRule') || 'top5'} />
                    : view === 'balance' && s.files.size > 0
                    ? (() => {
                        const idx = model.sliderValues ? model.sliderValues[1] : 0;
                        const { roots, netWorth } = buildBalanceTree(model.balances, idx);
                        return <BalanceView roots={roots} netWorth={netWorth} cur={model.currency || cur} />;
                      })()
                    : view === 'expenses' && s.files.size > 0
                    ? (() => { const tree = buildBreakdownTree(model.postings, 'expenses');
                        return <ExpensesIncomeView tree={tree} total={tree.reduce((a, n) => a + n.value, 0)} cur={model.currency || cur} kind="expense" />; })()
                    : view === 'income' && s.files.size > 0
                    ? (() => { const tree = buildBreakdownTree(model.postings, 'income');
                        return <ExpensesIncomeView tree={tree} total={tree.reduce((a, n) => a + n.value, 0)} cur={model.currency || cur} kind="income" />; })()
                    : view === 'assets' && s.files.size > 0
                    ? <AssetsView vm={buildAssets(model, deselAssets)} cur={model.currency || cur} />
                    : view === 'portfolio' && s.files.size > 0
                    ? <PortfolioView vm={portfolioVm} cur={model.currency || cur} />
                    : view === 'postings' && s.files.size > 0
                    ? <PostingsView rows={buildPostings(model)} query={s.query} typeFilter={s.postingType} cur={model.currency || cur} />
                    : view === 'options'
                    ? <OptionsView getSetting={getSetting} setSetting={setSetting} />
                    : <div data-view={view} />}
                </div>
                {showInsp && (() => {
                  const isAssetsTab = view === 'assets';
                  const assetAccounts = isAssetsTab ? buildAssetAccountList(model.balances) : [];
                  const assetTree = Object.fromEntries(assetAccounts.map(a => [a.key, {}]));
                  const inspDesel = isAssetsTab ? deselAssets : desel;
                  const inspOnToggle = isAssetsTab
                    ? (path) => setDeselectedAssets(prev => {
                        const n = new Set(prev);
                        n.has(path) ? n.delete(path) : n.add(path);
                        return n;
                      })
                    : (path) => setDeselected(prev => toggleAccountInDesel(path, prev, model.accountTree));
                  const inspOnAll = isAssetsTab
                    ? () => setDeselectedAssets(new Set())
                    : () => setDeselected(new Set());
                  const inspOnNone = isAssetsTab
                    ? () => setDeselectedAssets(new Set(assetAccounts.map(a => a.key)))
                    : () => setDeselected(new Set(Object.keys(model.accountTree || {})));
                  return (
                    <div className="chrome-print-hide" style={{ display: 'flex' }}>
                      <Inspector
                        desel={inspDesel}
                        onToggle={inspOnToggle}
                        onAll={inspOnAll}
                        onNone={inspOnNone}
                        onClose={() => setInsp(false)}
                        accountTree={isAssetsTab ? assetTree : model.accountTree}
                        intervals={model.fullIntervals}
                        sliderValues={inspectorSliderValues}
                        onRangeChange={(from, to) => {
                          const clampedFrom = portfolioMinIdx > 0 ? Math.max(from, portfolioMinIdx) : from;
                          onRangeChange(clampedFrom, to);
                        }}
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
        {/* print-only running footer (repeated on every printed sheet by Chromium) */}
        <div className="print-footer">Ledgerble — {t('print.footer')}</div>
    </div>
  );
}

export { Shell };
