// controls.jsx — Quiet Ledger atom components, ported verbatim from rd-base.jsx and rd-shell.jsx
import React from 'react';
import { T } from './tokens';
import { Icon } from './Icon';
const { t } = require('../../i18n');

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
export function Num({ children, color, weight = 460, size, style, className }) {
  return (
    <span className={className} style={{
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
      }}>{options.map(o => {
        const v = typeof o === 'object' ? o.value : o;
        const l = typeof o === 'object' ? o.label : o;
        return <option key={v} value={v}>{l}</option>;
      })}</select>
      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.ink3 }}><Icon name="chevronD" size={13} sw={1.8} /></span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DATE RANGE SLIDER — dual-thumb range over interval indices
// ─────────────────────────────────────────────────────────────
// Two overlaid native range inputs (so they are draggable + keyboard-accessible
// + easy to test) drive the [fromIdx, toIdx] selection; a custom pine track is
// drawn underneath for the Quiet Ledger look. The thumbs never cross.
export function DateRangeSlider({ intervals = [], value = [0, 0], onChange = () => {} }) {
  const n = intervals.length;
  const maxIdx = Math.max(0, n - 1);
  const disabled = n === 0;
  const from = Math.max(0, Math.min(value[0] || 0, maxIdx));
  const to = Math.max(from, Math.min(value[1] || 0, maxIdx));
  const fromLabel = intervals[from] || '';
  const toLabel = intervals[to] || '';
  const pct = (i) => (maxIdx === 0 ? 0 : (i / maxIdx) * 100);

  const [draftFrom, setDraftFrom] = React.useState(null);
  const [draftTo, setDraftTo] = React.useState(null);

  const resolveInterval = (raw) => {
    if (intervals.includes(raw)) return intervals.indexOf(raw);
    // Normalize unpadded segments: "2024-1" → "2024-01", "2022-1-5" → "2022-01-05"
    const normalized = raw.split('-').map((seg, i) => {
      if (i === 0) return seg; // year — never pad
      if (/^[QW]\d+$/.test(seg)) return seg[0] + seg.slice(1).padStart(2, '0');
      if (/^\d+$/.test(seg)) return seg.padStart(2, '0');
      return seg;
    }).join('-');
    return intervals.indexOf(normalized);
  };

  const commitFrom = (draft) => {
    const idx = resolveInterval(draft);
    if (idx >= 0) onChange(Math.min(idx, to), to);
    setDraftFrom(null);
  };
  const commitTo = (draft) => {
    const idx = resolveInterval(draft);
    if (idx >= 0) onChange(from, Math.max(idx, from));
    setDraftTo(null);
  };

  const boundInput = {
    width: 108, fontFamily: T.mono, fontSize: 12, padding: '5px 8px',
    border: `1px solid ${T.line2}`, borderRadius: 7, background: T.surface,
    color: T.ink, outline: 'none', textAlign: 'center',
  };
  const rangeBase = {
    position: 'absolute', top: 0, left: 0, width: '100%', height: 18, margin: 0,
    background: 'transparent', WebkitAppearance: 'none', appearance: 'none',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11 }}>
        <input
          value={draftFrom !== null ? draftFrom : fromLabel}
          aria-label="from"
          style={boundInput}
          onChange={e => setDraftFrom(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commitFrom(draftFrom !== null ? draftFrom : fromLabel);
            if (e.key === 'Escape') setDraftFrom(null);
          }}
          onBlur={() => { if (draftFrom !== null) commitFrom(draftFrom); }}
        />
        <span style={{ color: T.ink4, fontSize: 12 }}>—</span>
        <input
          value={draftTo !== null ? draftTo : toLabel}
          aria-label="to"
          style={boundInput}
          onChange={e => setDraftTo(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commitTo(draftTo !== null ? draftTo : toLabel);
            if (e.key === 'Escape') setDraftTo(null);
          }}
          onBlur={() => { if (draftTo !== null) commitTo(draftTo); }}
        />
      </div>
      <div className="rd-daterange" style={{ position: 'relative', height: 18, margin: '0 4px 18px' }}>
        <div style={{ position: 'absolute', top: 7, left: 0, right: 0, height: 4, borderRadius: 2, background: T.sink }} />
        <div style={{ position: 'absolute', top: 7, left: `${pct(from)}%`, right: `${100 - pct(to)}%`, height: 4, borderRadius: 2, background: T.pine, opacity: 0.85 }} />
        <input
          data-testid="range-from" type="range" min={0} max={maxIdx} value={from} disabled={disabled}
          onChange={(e) => { const v = Math.min(Number(e.target.value), to); onChange(v, to); }}
          style={{ ...rangeBase, zIndex: from >= to ? 4 : 3 }} aria-label="range-from"
        />
        <input
          data-testid="range-to" type="range" min={0} max={maxIdx} value={to} disabled={disabled}
          onChange={(e) => { const v = Math.max(Number(e.target.value), from); onChange(from, v); }}
          style={{ ...rangeBase, zIndex: 3 }} aria-label="range-to"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SEARCH FIELD — ported from rd-shell.jsx
// ─────────────────────────────────────────────────────────────
export function SearchField({ query, onChange, width = 172, placeholder }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <span style={{ position: 'absolute', left: 9, color: T.ink4, display: 'flex', pointerEvents: 'none' }}><Icon name="search" size={14} /></span>
      <input value={query} onChange={e => onChange(e.target.value)} placeholder={placeholder || t('search.placeholder')}
        style={{ width, fontFamily: T.sans, fontSize: 12.5, padding: '5px 10px 5px 28px', border: `1px solid ${T.line2}`, borderRadius: 7, background: T.surface, color: T.ink, outline: 'none', boxSizing: 'border-box' }} />
    </div>
  );
}
