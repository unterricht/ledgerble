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
import { Icon } from '../ui/Icon';
import { Segmented, Eyebrow, Num, MenuSelect, SearchField } from '../ui/controls';
import { makeTypeExtractor } from '../data/typeExtractor';
import { compute } from '../data/compute';
import { buildOverview, buildBreakdownTree, buildBalanceTree, buildAssets, buildPortfolio, buildPostings } from '../data/adapters';
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

function makeGetSetting(cache) {
  return (key) => {
    const val = cache[key];
    return val !== undefined ? val : SETTINGS_DEFAULTS[key];
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
  { group: 'Reports', items: [
    { id: 'overview',  label: 'Income & Expenses',  icon: 'overview'  },
    { id: 'balance',   label: 'Balance',             icon: 'balance'   },
    { id: 'expenses',  label: 'Expenses',            icon: 'expenses'  },
    { id: 'income',    label: 'Income',              icon: 'income'    },
    { id: 'assets',    label: 'Assets & Liabilities',icon: 'assets'    },
    { id: 'portfolio', label: 'Portfolio',           icon: 'portfolio' },
  ]},
  { group: 'Ledger', items: [
    { id: 'postings',  label: 'Postings',            icon: 'postings'  },
  ]},
];

const TITLES = {
  overview:  'Income & Expenses',
  balance:   'Balance',
  expenses:  'Expenses',
  income:    'Income',
  assets:    'Assets & Liabilities',
  portfolio: 'Portfolio',
  postings:  'Postings',
  options:   'Options',
};

const FILTER_TABS = new Set(['overview', 'balance', 'expenses', 'income', 'assets', 'portfolio']);
const PERIOD_TABS = new Set(['overview', 'balance', 'expenses', 'income', 'assets', 'portfolio']);

// ── window controls ──────────────────────────────────────────
function TrafficLights() {
  const dot = c => ({ width: 12, height: 12, borderRadius: '50%', background: c, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.12)' });
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={dot('#FF5F57')} /><span style={dot('#FEBC2E')} /><span style={dot('#28C840')} />
    </div>
  );
}

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

// ── account filter tree (inspector) ──────────────────────────
function Inspector({ desel, onToggle, onAll, onNone, onClose, accountTree }) {
  const flat = [];
  if (accountTree && typeof accountTree === 'object' && !Array.isArray(accountTree)) {
    flattenAccountTree(accountTree, '', flat);
  } else if (Array.isArray(accountTree)) {
    flat.push(...accountTree);
  }
  const total = flat.length;
  const active = total - (desel ? desel.size : 0);
  const ghost = { fontFamily: T.sans, fontSize: 11.5, fontWeight: 500, padding: '4px 10px', borderRadius: 6, border: `1px solid ${T.line2}`, background: T.surface, color: T.ink2, cursor: 'pointer' };
  return (
    <div style={{ width: 248, flexShrink: 0, borderLeft: `1px solid ${T.line}`, background: T.surface, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: `1px solid ${T.line}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: T.sans }}>Filters</span>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.ink3, padding: 2, display: 'flex' }}><Icon name="sliders" size={15} /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        <Eyebrow style={{ marginBottom: 9 }}>Date range</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11 }}>
          <input defaultValue="2018-01" style={{ width: 78, fontFamily: T.mono, fontSize: 12, padding: '5px 8px', border: `1px solid ${T.line2}`, borderRadius: 7, background: T.surface, color: T.ink, outline: 'none', textAlign: 'center' }} />
          <span style={{ color: T.ink4, fontSize: 12 }}>—</span>
          <input defaultValue="2018-12" style={{ width: 78, fontFamily: T.mono, fontSize: 12, padding: '5px 8px', border: `1px solid ${T.line2}`, borderRadius: 7, background: T.surface, color: T.ink, outline: 'none', textAlign: 'center' }} />
        </div>
        <div style={{ position: 'relative', height: 18, margin: '0 4px 18px' }}>
          <div style={{ position: 'absolute', top: 7, left: 0, right: 0, height: 4, borderRadius: 2, background: T.sink }} />
          <div style={{ position: 'absolute', top: 7, left: '2%', right: '2%', height: 4, borderRadius: 2, background: T.pine, opacity: 0.85 }} />
          {['2%', '98%'].map((l, i) => <div key={i} style={{ position: 'absolute', top: 1, left: l, transform: 'translateX(-50%)', width: 15, height: 15, borderRadius: '50%', background: T.surface, border: `1.5px solid ${T.pine}`, boxShadow: '0 1px 3px rgba(16,18,22,0.18)', cursor: 'grab' }} />)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
          <Eyebrow>Accounts</Eyebrow>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={ghost} onClick={onAll}>All</button>
            <button style={ghost} onClick={onNone}>None</button>
          </div>
        </div>
        {flat.map(acc => {
          const name = typeof acc === 'string' ? acc : acc.account;
          const checked = !desel || !desel.has(name);
          return (
            <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', cursor: 'pointer' }}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(name)}
                style={{ accentColor: T.pine, width: 13, height: 13, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, fontFamily: T.sans, color: T.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            </label>
          );
        })}
      </div>
      <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.line}`, fontSize: 11.5, color: T.ink3, fontFamily: T.sans }}>
        Showing <span style={{ color: T.ink2, fontWeight: 600 }}>{active}</span> of {total} accounts
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
      {item.label}
    </button>
  );
}

// ── journal file menu (bottom-left) ──────────────────────────
function JournalFooter() {
  const [files, setFiles] = useState(['cody.journal']);
  const [open, setOpen] = useState(false);
  const item = { padding: '7px 12px', fontSize: 12.5, fontFamily: T.sans, color: T.ink, cursor: 'default', display: 'flex', alignItems: 'center', gap: 9, whiteSpace: 'nowrap' };
  const menu = (
    <>
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, minWidth: 188, zIndex: 41, background: T.surface, border: `1px solid ${T.line2}`, borderRadius: 9, padding: '5px', boxShadow: '0 12px 30px -8px rgba(16,18,22,0.30), 0 0 0 0.5px rgba(16,18,22,0.06)' }}>
        <div className="rd-menu" style={{ ...item, borderRadius: 6 }} onClick={() => { setFiles(['cody.journal']); setOpen(false); }}><Icon name="files" size={15} stroke={T.ink3} /> Open File…</div>
        <div className="rd-menu" style={{ ...item, borderRadius: 6 }} onClick={() => setOpen(false)}><Icon name="reload" size={15} stroke={T.ink3} /> Reload Files</div>
        <div className="rd-menu" style={{ ...item, borderRadius: 6 }} onClick={() => setOpen(false)}><Icon name="overview" size={15} stroke={T.ink3} /> Reveal in Finder</div>
        <div style={{ height: 1, background: T.line, margin: '4px 6px' }} />
        <div className="rd-menu" style={{ ...item, borderRadius: 6, color: T.neg }} onClick={() => { setFiles([]); setOpen(false); }}>Remove from list</div>
      </div>
    </>
  );
  return (
    <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 8, position: 'relative' }}>
      {files.length === 0 ? (
        <button className="rd-nav" onClick={() => setFiles(['cody.journal'])} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px dashed ${T.line2}`, background: 'transparent', cursor: 'pointer', fontFamily: T.sans, fontSize: 12.5, color: T.ink2 }}>
          <Icon name="files" size={15} stroke={T.ink3} /> Open ledger file…
        </button>
      ) : (
        <div className="rd-nav" onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, cursor: 'pointer' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.pos, flexShrink: 0 }} />
          <Num color={T.ink2} size={11.5} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{files[0]}{files.length > 1 ? ` +${files.length - 1}` : ''}</Num>
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
      <span className="rd-menu" style={{ ...itemStyle, background: open ? 'rgba(16,18,22,0.08)' : undefined }} onClick={() => setOpen(o => !o)}>File</span>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 210, zIndex: 61, background: T.surface, border: `1px solid ${T.line2}`, borderRadius: 9, padding: 5, boxShadow: '0 14px 34px -8px rgba(16,18,22,0.32), 0 0 0 0.5px rgba(16,18,22,0.06)' }}>
            <div className="rd-menu" style={row} onClick={() => setOpen(false)}>Open File… <span style={acc}>{mod}O</span></div>
            <div className="rd-menu" style={row} onClick={() => setOpen(false)}>Reload Files <span style={acc}>{mod}R</span></div>
            <div style={{ height: 1, background: T.line, margin: '4px 6px' }} />
            <div className="rd-menu" style={row} onClick={() => { setOpen(false); onPrint(); }}>Print… <span style={acc}>{mod}P</span></div>
            <div className="rd-menu" style={row} onClick={() => { setOpen(false); onPrint(); }}>Print to PDF…</div>
          </div>
        </>
      )}
    </span>
  );
}

// ── macOS global menu bar ────────────────────────────────────
function MacMenuBar({ onPrint }) {
  const menus = ['Edit', 'View', 'Window'];
  const item = { padding: '2px 9px', borderRadius: 5, fontSize: 13, fontFamily: T.sans, color: T.ink, cursor: 'default', lineHeight: 1.2 };
  return (
    <div className="chrome-print-hide" style={{
      height: 26, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, padding: '0 9px',
      background: 'rgba(245,246,249,0.72)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderBottom: '0.5px solid rgba(16,18,22,0.10)', position: 'relative', zIndex: 30,
    }}>
      <span className="rd-menu" style={{ ...item, fontWeight: 680, padding: '2px 10px' }}>Ledgerble</span>
      <FileMenu mod="⌘" onPrint={onPrint} itemStyle={item} />
      {menus.map(m => <span key={m} className="rd-menu" style={item}>{m}</span>)}
      <div style={{ flex: 1 }} />
      <span style={{ ...item, fontWeight: 500 }}>Sun 1 Jun&nbsp;&nbsp;9:41</span>
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────
function Shell() {
  const plat = (window.api && window.api.platform === 'win32') ? 'win' : 'mac';
  const netColor = '#7A47C2';

  const s = useAppState();
  const { view, setView, currency: cur, setCurrency: setCur, period, setPeriod,
          deselectedAccounts: desel, toggleAccount: toggle, setDeselected,
          inspectorOpen: insp, setInspectorOpen: setInsp,
          query, setQuery, postingType: typeF, setPostingType: setTypeF } = s;

  // ── Settings cache ───────────────────────────────────────────────────────
  const [settingsCache, setSettingsCache] = useState({});
  useEffect(() => {
    if (window.api && window.api.settings && window.api.settings.getAll) {
      window.api.settings.getAll().then(cache => {
        if (cache && typeof cache === 'object') setSettingsCache(cache);
      }).catch(() => {});
    }
  }, []);

  const getSetting = useMemo(() => makeGetSetting(settingsCache), [settingsCache]);
  const typeExtractor = useMemo(() => makeTypeExtractor(getSetting), [getSetting]);

  // setSetting: persists to main process AND updates React cache so all views re-render.
  const setSetting = (key, value) => {
    setSettingsCache(prev => ({ ...prev, [key]: value }));
    if (window.api && window.api.settings && window.api.settings.set) {
      window.api.settings.set(key, value);
    }
  };

  // ── Compute model ────────────────────────────────────────────────────────
  const model = useMemo(
    () => compute({
      files: s.files,
      currency: s.currency,
      period: s.period,
      deselectedAccounts: s.deselectedAccounts,
      dateRange: s.dateRange,
      typeExtractor,
    }),
    [s.files, s.currency, s.period, s.deselectedAccounts, s.dateRange, typeExtractor]
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

  const showInsp = FILTER_TABS.has(view) && insp;

  const onSearch = v => { setQuery(v); };

  const doPrint = () => window.print();
  useEffect(() => {
    const onKey = e => { if ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); window.print(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const subtitle = (() => {
    if (view === 'options') return 'Preferences';
    if (view === 'postings') return 'All transactions · 2018';
    if (view === 'balance') return `As of 31 December 2018 · ${period}`;
    return `${period} · Jan – Dec 2018`;
  })();

  const fonts = FONT_STACK[plat];
  const cardRadius = plat === 'win' ? 8 : 13;

  const brand = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <img src="icons/gerbil.webp" width={20} height={20} alt="" style={{ display: 'block' }} />
      <span style={{ fontSize: 14, fontWeight: 600, color: T.ink, fontFamily: T.sans, letterSpacing: '-0.02em' }}>Ledger<span style={{ color: T.pine }}>ble</span></span>
    </div>
  );

  const macBar = (
    <div className="chrome-print-hide" style={{ display: 'flex', alignItems: 'center', height: 48, background: T.sidebar, borderBottom: `1px solid ${T.line}`, paddingLeft: 18, paddingRight: 12, flexShrink: 0, gap: 12 }}>
      <TrafficLights />
      <div style={{ width: 196, paddingLeft: 8 }}>{brand}</div>
      <div style={{ flex: 1 }} />
      <SearchField query={query} onChange={onSearch} />
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
        {['Edit', 'View', 'Help'].map(m => <span key={m} className="rd-menu" style={winMenuItem}>{m}</span>)}
        <div style={{ flex: 1 }} />
        <SearchField query={query} onChange={onSearch} width={196} />
      </div>
    </div>
  );

  return (
    <div className="app-root" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', '--rd-sans': fonts.sans, '--rd-mono': fonts.mono }}>
      {plat === 'mac' && <MacMenuBar onPrint={doPrint} />}
      <div className="app-stage" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '26px 28px 30px' }}>
        <div className="print-card" style={{
          width: 'min(1240px, 100%)', height: '100%', maxHeight: 806,
          background: T.surface, borderRadius: cardRadius, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 40px 80px -24px rgba(16,18,22,0.40), 0 12px 28px -12px rgba(16,18,22,0.22), 0 0 0 0.5px rgba(16,18,22,0.10)',
        }}>
          {plat === 'mac' ? macBar : winBar}

          {/* ── body ── */}
          <div className="card-body" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* sidebar */}
            <nav className="chrome-print-hide" style={{ width: 224, flexShrink: 0, background: T.sidebar, borderRight: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', padding: '8px 10px' }}>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {NAV.map(g => (
                  <div key={g.group} style={{ marginBottom: 14 }}>
                    <div style={{ padding: '4px 10px 6px' }}><Eyebrow>{g.group}</Eyebrow></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {g.items.map(it => <NavItem key={it.id} item={it} active={view === it.id} onClick={() => setView(it.id)} />)}
                    </div>
                  </div>
                ))}
              </div>
              {/* footer: options + journal file menu */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <NavItem item={{ id: 'options', label: 'Options', icon: 'options' }} active={view === 'options'} onClick={() => setView('options')} />
                <JournalFooter />
              </div>
            </nav>

            {/* main pane */}
            <div className="main-pane" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.surface }}>
              {/* print-only header */}
              <div id="printHeader" style={{ display: 'none', padding: '0 0 14px', marginBottom: 10, borderBottom: `1px solid ${T.line2}` }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, fontFamily: T.sans }}>{TITLES[view]} — cody.journal</div>
                <div style={{ fontSize: 12, color: T.ink2, fontFamily: T.sans, marginTop: 3 }}>{subtitle} · {cur} · printed 1 Jun 2026</div>
              </div>
              {/* pane header */}
              <div className="chrome-print-hide" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', borderBottom: `1px solid ${T.line}`, flexShrink: 0, background: T.surface }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 640, color: T.ink, fontFamily: T.sans, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{TITLES[view]}</div>
                  <div style={{ fontSize: 12, color: T.ink3, fontFamily: T.sans, marginTop: 2 }}>{subtitle}</div>
                </div>
                <div style={{ flex: 1 }} />
                {view === 'postings' ? (
                  <Segmented options={[{ value: 'all', label: 'All' }, { value: 'income', label: 'Income' }, { value: 'expenses', label: 'Expenses' }, { value: 'assets', label: 'Assets' }]} value={typeF} onChange={setTypeF} size="sm" />
                ) : view === 'options' ? null : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    {PERIOD_TABS.has(view) && <MenuSelect value={period} onChange={setPeriod} options={['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly']} />}
                    <MenuSelect value={model.currency || cur} onChange={setCur} options={(model.currencies && model.currencies.length > 0) ? model.currencies : ['USD', 'EUR', 'GBP']} width={76} />
                    {FILTER_TABS.has(view) && (
                      <button onClick={() => setInsp(v => !v)} title="Toggle filters" style={{
                        display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.sans, fontSize: 12.5, fontWeight: 500,
                        padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
                        border: `1px solid ${showInsp ? T.pine : T.line2}`, background: showInsp ? T.pineSoft : T.surface, color: showInsp ? T.pineStrong : T.ink2,
                      }}><Icon name="sliders" size={15} stroke={showInsp ? T.pine : T.ink3} /> Filters</button>
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
                    ? <AssetsView vm={buildAssets(model)} cur={model.currency || cur} />
                    : view === 'portfolio' && s.files.size > 0
                    ? <PortfolioView vm={buildPortfolio(model)} cur={model.currency || cur} />
                    : view === 'postings' && s.files.size > 0
                    ? <PostingsView rows={buildPostings(model)} query={s.query} typeFilter={s.postingType} cur={model.currency || cur} />
                    : view === 'options'
                    ? <OptionsView getSetting={getSetting} setSetting={setSetting} />
                    : <div data-view={view} />}
                </div>
                {showInsp && (() => {
                  const allPaths = [];
                  flattenAccountTree(model.accountTree, '', allPaths);
                  return (
                  <div className="chrome-print-hide" style={{ display: 'flex' }}>
                    <Inspector
                      desel={desel}
                      onToggle={toggle}
                      onAll={() => setDeselected(new Set())}
                      onNone={() => setDeselected(new Set(allPaths))}
                      onClose={() => setInsp(false)}
                      accountTree={model.accountTree}
                    />
                  </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Shell };
