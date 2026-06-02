// controls.jsx — Quiet Ledger atom components, ported verbatim from rd-base.jsx and rd-shell.jsx
import React from 'react';
import { T } from './tokens';
import { Icon } from './Icon';

// ─────────────────────────────────────────────────────────────
// SEGMENTED CONTROL — macOS-style pill segmented control
// ─────────────────────────────────────────────────────────────
export function Segmented({ options, value, onChange, size = 'md' }) {
  const pad = size === 'sm' ? '3px 10px' : '4px 13px';
  const fs = size === 'sm' ? 11.5 : 12.5;
  return (
    <div style={{
      display: 'inline-flex', padding: 2, gap: 2, background: T.sink,
      borderRadius: 8, border: `0.5px solid ${T.line2}`,
    }}>
      {options.map(opt => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        const active = v === value;
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            padding: pad, fontSize: fs, fontFamily: T.sans,
            fontWeight: active ? 590 : 480,
            color: active ? T.ink : T.ink2,
            background: active ? T.surface : 'transparent',
            border: 'none', borderRadius: 6, cursor: 'pointer',
            boxShadow: active ? '0 1px 2px rgba(16,18,22,0.10), 0 0 0 0.5px rgba(16,18,22,0.04)' : 'none',
            transition: 'color 120ms, background 120ms', whiteSpace: 'nowrap',
            letterSpacing: '-0.005em',
          }}>{label}</button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FIELD LABEL — quiet uppercase micro-label
// ─────────────────────────────────────────────────────────────
export function Eyebrow({ children, style }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em',
      textTransform: 'uppercase', color: T.ink3, fontFamily: T.sans, ...style,
    }}>{children}</div>
  );
}

// monospace numeral span
export function Num({ children, color, weight = 460, size, style }) {
  return (
    <span style={{
      fontFamily: T.mono, fontVariantNumeric: 'tabular-nums',
      fontFeatureSettings: '"tnum"', color, fontWeight: weight,
      fontSize: size, letterSpacing: '-0.01em', ...style,
    }}>{children}</span>
  );
}

// ─────────────────────────────────────────────────────────────
// MENU-STYLE SELECT — ported from rd-shell.jsx
// ─────────────────────────────────────────────────────────────
export function MenuSelect({ value, onChange, options, width }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        appearance: 'none', WebkitAppearance: 'none', fontFamily: T.sans, fontSize: 12.5, fontWeight: 500,
        padding: '5px 26px 5px 11px', border: `1px solid ${T.line2}`, borderRadius: 7, background: T.surface,
        color: T.ink, cursor: 'pointer', outline: 'none', width, boxShadow: '0 1px 1.5px rgba(16,18,22,0.04)',
      }}>{options.map(o => <option key={o} value={o}>{o}</option>)}</select>
      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.ink3 }}><Icon name="chevronD" size={13} sw={1.8} /></span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SEARCH FIELD — ported from rd-shell.jsx
// ─────────────────────────────────────────────────────────────
export function SearchField({ query, onChange, width = 172 }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <span style={{ position: 'absolute', left: 9, color: T.ink4, display: 'flex', pointerEvents: 'none' }}><Icon name="search" size={14} /></span>
      <input value={query} onChange={e => onChange(e.target.value)} placeholder="Search postings"
        style={{ width, fontFamily: T.sans, fontSize: 12.5, padding: '5px 10px 5px 28px', border: `1px solid ${T.line2}`, borderRadius: 7, background: T.surface, color: T.ink, outline: 'none' }} />
    </div>
  );
}
