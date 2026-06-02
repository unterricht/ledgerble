// BarBreakdown.jsx — drill-down horizontal bar breakdown component
// Ported verbatim from Entwicklung/redesign/project/ui_kits/ledgerble/rd-charts.jsx
import React, { useState } from 'react';
import { T, money } from '../ui/tokens';
import { Icon } from '../ui/Icon';
import { Eyebrow, Num } from '../ui/controls';

// ─────────────────────────────────────────────────────────────
// BAR BREAKDOWN (expenses / income) — ranked horizontal bars with
// drill-down. Replaces the nested treemap: hierarchy is shown by
// indentation, and a parent's un-subcategorised remainder gets its
// own explicit "(without subcategory)" row instead of a mystery box.
// ─────────────────────────────────────────────────────────────
function BarNode({ node, depth, color, topMax, total, cur, openSet, toggle, path }) {
  const kids = node.children || [];
  let rows = kids.map(c => ({ ...c }));
  if (kids.length) {
    const childSum = kids.reduce((a, c) => a + c.value, 0);
    const diff = node.value - childSum;
    if (diff > 0.01) rows.push({ name: node.name + '·direct', label: node.label, value: diff, __direct: true });
  }
  rows.sort((a, b) => b.value - a.value);
  const hasKids = rows.length > 0;
  const open = openSet.has(path);
  const pct = node.value / total * 100;
  const w = Math.max(1.5, node.value / topMax * 100);
  const labelColor = node.__direct ? T.ink3 : (depth === 0 ? T.ink : T.ink2);
  const fillBg = node.__direct
    ? `repeating-linear-gradient(135deg, ${color}99 0 5px, ${color}4d 5px 10px)`
    : color;
  return (
    <>
      <div className="rd-row" onClick={() => hasKids && toggle(path)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 22px', cursor: hasKids ? 'pointer' : 'default' }}>
        <div style={{ width: 240, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, paddingLeft: depth * 17 }}>
          <span style={{ width: 12, display: 'flex', justifyContent: 'center', flexShrink: 0, color: T.ink4, transition: 'transform 140ms', transform: open ? 'rotate(90deg)' : 'none' }}>
            {hasKids ? <Icon name="chevron" size={10} sw={2} /> : null}
          </span>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: node.__direct ? 'transparent' : color, border: node.__direct ? `1.5px dashed ${color}` : 'none', flexShrink: 0 }} />
          <span style={{ fontSize: depth === 0 ? 13 : 12.5, color: labelColor, fontFamily: T.sans, fontWeight: depth === 0 ? 540 : 430, fontStyle: node.__direct ? 'italic' : 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {node.__direct ? `${node.label} · not itemised` : node.label}
          </span>
        </div>
        <div style={{ flex: 1, height: 13, background: T.sink, borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
          <div style={{ width: w + '%', height: '100%', background: fillBg, borderRadius: 4, transition: 'width 200ms' }} />
        </div>
        <div style={{ width: 92, textAlign: 'right', flexShrink: 0 }}><Num color={node.__direct ? T.ink3 : T.ink} size={12.5} weight={node.__direct ? 430 : 520}>{money(node.value, { cents: false, cur })}</Num></div>
        <div style={{ width: 42, textAlign: 'right', flexShrink: 0 }}><Num color={T.ink3} size={12}>{pct < 1 ? '<1' : Math.round(pct)}%</Num></div>
      </div>
      {open && rows.map(c => (
        <BarNode key={c.name} node={c} depth={depth + 1} color={color} topMax={topMax} total={total} cur={cur} openSet={openSet} toggle={toggle} path={path + '/' + c.name} />
      ))}
    </>
  );
}

export function BarBreakdown({ tree, total, cur }) {
  const sorted = [...tree].sort((a, b) => b.value - a.value);
  const topMax = Math.max(...sorted.map(n => n.value), 1);
  const [openSet, setOpenSet] = useState(() => new Set());
  const toggle = p => setOpenSet(s => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const anyKids = sorted.some(n => (n.children || []).length);
  return (
    <div style={{ padding: '8px 0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px 8px' }}>
        <div style={{ width: 240, flexShrink: 0 }}><Eyebrow>Category</Eyebrow></div>
        <div style={{ flex: 1 }}><Eyebrow>Share of total</Eyebrow></div>
        <div style={{ width: 92, textAlign: 'right', flexShrink: 0 }}><Eyebrow>Amount</Eyebrow></div>
        <div style={{ width: 42 }} />
      </div>
      {sorted.map((n, i) => (
        <BarNode key={n.name} node={n} depth={0} color={T.chart[i % T.chart.length]} topMax={topMax} total={total} cur={cur} openSet={openSet} toggle={toggle} path={n.name} />
      ))}
      {anyKids && <div style={{ padding: '12px 22px 0', fontSize: 11.5, color: T.ink4, fontFamily: T.sans }}>Click a category with a ▸ to break it down by sub-account.</div>}
    </div>
  );
}
