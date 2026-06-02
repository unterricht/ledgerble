// OptionsView.jsx — Settings form in GroupCard style (macOS System-Settings-style).
// Ported and wired from Entwicklung/redesign/project/ui_kits/ledgerble/rd-views2.jsx ~185-251.
//
// Props:
//   getSetting(key)          — reads from Shell's settingsCache (with SETTINGS_DEFAULTS fallback)
//   setSetting(key, value)   — writes to settingsCache AND calls window.api.settings.set
import React, { useState } from 'react';
import { T } from '../ui/tokens';
import { Eyebrow } from '../ui/controls';
import { getAvailableLocales } from '../../i18n';
import { RULE_LABEL } from '../data/pickCats';

// ── Regex defaults (mirrors options.js allSettings) ─────────────────────────
const REGEX_DEFAULTS = {
  'options.expenses.regex':     '^expenses?(:|$)',
  'options.income.regex':       '^(income|revenue)s?(:|$)',
  'options.assets.regex':       '^assets?(:|$)',
  'options.liabilities.regex':  '^(debts?|liabilit(y|ies))(:|$)',
  'options.equity.regex':       '^equity(:|$)',
};

// ── Primitive style helpers ──────────────────────────────────────────────────
function inputStyle(w) {
  return {
    width: w,
    fontFamily: T.mono,
    fontSize: 12.5,
    padding: '6px 10px',
    border: `1px solid ${T.line2}`,
    borderRadius: 7,
    background: T.surface,
    color: T.ink,
    outline: 'none',
    boxSizing: 'border-box',
  };
}

const btnStyle = {
  fontFamily: T.sans,
  fontSize: 12,
  fontWeight: 500,
  padding: '6px 12px',
  borderRadius: 7,
  border: `1px solid ${T.line2}`,
  background: T.surface,
  color: T.ink,
  cursor: 'pointer',
};

// ── GroupCard ────────────────────────────────────────────────────────────────
function GroupCard({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ padding: '0 4px 8px' }}><Eyebrow>{title}</Eyebrow></div>
      <div style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(16,18,22,0.03)',
      }}>{children}</div>
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────
function Row({ label, hint, children, last }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '13px 18px',
      borderBottom: last ? 'none' : `1px solid ${T.line}`,
    }}>
      <div style={{ width: 220, flexShrink: 0 }}>
        <div style={{ fontSize: 13, color: T.ink, fontFamily: T.sans, fontWeight: 480 }}>{label}</div>
        {hint && (
          <div style={{ fontSize: 11.5, color: T.ink3, fontFamily: T.sans, marginTop: 2 }}>{hint}</div>
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

// ── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ on, onClick, testId }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      style={{
        width: 40,
        height: 24,
        borderRadius: 12,
        border: 'none',
        padding: 2,
        cursor: 'pointer',
        background: on ? T.pine : T.line2,
        transition: 'background 160ms',
        display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start',
      }}
    >
      <span style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'all 160ms',
      }} />
    </button>
  );
}

// ── RegexRow — text input + "Use default" button ─────────────────────────────
function RegexRow({ label, hint, settingKey, getSetting, setSetting, last }) {
  const [localVal, setLocalVal] = useState(() => getSetting(settingKey) || REGEX_DEFAULTS[settingKey]);

  const commit = (val) => {
    setLocalVal(val);
    setSetting(settingKey, val);
  };

  const useDefault = () => {
    const def = REGEX_DEFAULTS[settingKey];
    commit(def);
  };

  // Derive a testId from the key, e.g. options.expenses.regex → expenses-regex
  const slug = settingKey.replace('options.', '').replace(/\./g, '-');

  return (
    <Row label={label} hint={hint} last={last}>
      <input
        data-testid={`input-${slug}`}
        value={localVal}
        onChange={e => setLocalVal(e.target.value)}
        onBlur={e => commit(e.target.value)}
        style={inputStyle(220)}
      />
      <button
        data-testid={`btn-default-${slug}`}
        style={btnStyle}
        onClick={useDefault}
      >
        Use default
      </button>
    </Row>
  );
}

// ── OptionsView ───────────────────────────────────────────────────────────────
function OptionsView({ getSetting, setSetting }) {
  // Local state mirrors the persisted values so the form is reactive
  const [hledger, setHledger] = useState(() => !!getSetting('options.hledger'));
  const [ledgerCmd, setLedgerCmd] = useState(() => getSetting('options.ledger.command') || 'ledger');
  const [locale, setLocale] = useState(() => getSetting('options.locale') || 'auto');
  const [catRule, setCatRule] = useState(() => getSetting('options.overview.catRule') || 'top5');

  const locales = ['auto', ...getAvailableLocales()];

  const handleHledgerToggle = () => {
    const next = !hledger;
    setHledger(next);
    setSetting('options.hledger', next);
  };

  const handleLedgerCmdBlur = (e) => {
    const val = e.target.value;
    setLedgerCmd(val);
    setSetting('options.ledger.command', val);
  };

  const handleLocaleChange = (e) => {
    const val = e.target.value;
    setLocale(val);
    setSetting('options.locale', val);
    if (window.api && window.api.menu && window.api.menu.rebuild) {
      window.api.menu.rebuild();
    }
  };

  const handleCatRuleChange = (e) => {
    const val = e.target.value;
    setCatRule(val);
    setSetting('options.overview.catRule', val);
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: T.bg, padding: '24px 28px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* ── Ledger command ── */}
        <GroupCard title="Ledger command">
          <Row label="ledger-cli path" hint="Executable used to read journals">
            <input
              data-testid="input-ledger-command"
              value={ledgerCmd}
              onChange={e => setLedgerCmd(e.target.value)}
              onBlur={handleLedgerCmdBlur}
              style={inputStyle(280)}
            />
            {/* Browse: no renderer-accessible file-picker IPC; rendered as no-op placeholder */}
            <button style={btnStyle} disabled title="File picker not yet wired via IPC">Browse…</button>
          </Row>
          <Row label="Use hledger" hint="Run hledger instead of ledger-cli" last>
            <Toggle
              testId="toggle-hledger"
              on={hledger}
              onClick={handleHledgerToggle}
            />
          </Row>
        </GroupCard>

        {/* ── Account matching ── */}
        <GroupCard title="Account matching">
          <RegexRow
            label="Expense accounts"
            hint="Regex matching expense accounts"
            settingKey="options.expenses.regex"
            getSetting={getSetting}
            setSetting={setSetting}
          />
          <RegexRow
            label="Income accounts"
            hint="Regex matching income/revenue accounts"
            settingKey="options.income.regex"
            getSetting={getSetting}
            setSetting={setSetting}
          />
          <RegexRow
            label="Asset accounts"
            hint="Regex matching asset accounts"
            settingKey="options.assets.regex"
            getSetting={getSetting}
            setSetting={setSetting}
          />
          <RegexRow
            label="Liability accounts"
            hint="Regex matching liability accounts"
            settingKey="options.liabilities.regex"
            getSetting={getSetting}
            setSetting={setSetting}
          />
          <RegexRow
            label="Equity accounts"
            hint="Regex matching equity accounts"
            settingKey="options.equity.regex"
            getSetting={getSetting}
            setSetting={setSetting}
            last
          />
        </GroupCard>

        {/* ── General ── */}
        <GroupCard title="General">
          <Row label="Language" hint="Interface language">
            <select
              data-testid="select-locale"
              value={locale}
              onChange={handleLocaleChange}
              style={{ ...inputStyle(160), fontFamily: T.sans, cursor: 'pointer' }}
            >
              {locales.map(l => (
                <option key={l} value={l}>{l === 'auto' ? 'Auto (system)' : l}</option>
              ))}
            </select>
          </Row>
          <Row label="Category table (Top-N)" hint="How many expense categories to show in Overview" last>
            <select
              data-testid="select-cat-rule"
              value={catRule}
              onChange={handleCatRuleChange}
              style={{ ...inputStyle(160), fontFamily: T.sans, cursor: 'pointer' }}
            >
              {Object.entries(RULE_LABEL).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </Row>
        </GroupCard>

      </div>
    </div>
  );
}

export { OptionsView };
