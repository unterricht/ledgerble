// BalanceView.jsx — Nested expandable account tree table with net-worth figure.
// Ported from Entwicklung/redesign/project/ui_kits/ledgerble/rd-views.jsx (BalRow + BalanceView).
// Props: { roots, netWorth, cur }
//   roots    — Node[] from buildBalanceTree(): { id, account, balance, type, children }
//   netWorth — number (assets + liabilities, per balance.js convention)
//   cur      — display currency string (e.g. 'USD')
import React, { useState } from 'react';
import { T, money } from '../ui/tokens';
import { Num } from '../ui/controls';
import { Icon } from '../ui/Icon';
const { t } = require('../../i18n');

// ── table style helpers ──────────────────────────────────────────────────────
const thStyle = (align = 'left') => ({
  padding: '10px 16px', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.05em',
  textTransform: 'uppercase', color: T.ink3, textAlign: align,
  borderBottom: `1px solid ${T.line}`, background: T.surface, position: 'sticky', top: 0,
  fontFamily: T.sans, whiteSpace: 'nowrap',
});
const tdStyle = (align = 'left') => ({
  padding: '11px 16px', textAlign: align, borderBottom: `1px solid ${T.line}`,
  verticalAlign: 'middle',
});

// Balance colour by type — mirroring rd-views.jsx BAL_COLOR
const BAL_COLOR = {
  assets:      T.pos,
  liabilities: T.neg,
  income:      T.pos,
  expenses:    T.neg,
  equity:      T.ink3,
};

// ── BalRow ───────────────────────────────────────────────────────────────────
// Renders one account row. Clicking a row with children toggles expansion.
// Indentation increases by 20px per depth level.
function BalRow({ node, depth, expanded, onToggle, cur }) {
  const hasKids = !!(node.children && node.children.length);
  const open = expanded.has(node.id);
  // Show only the last path segment for child rows; full name for root rows.
  const label = depth === 0 ? node.account : node.account.split(':').pop();
  const c = BAL_COLOR[node.type] || T.ink2;
  return (
    <>
      <tr
        className="rd-row"
        onClick={() => hasKids && onToggle(node.id)}
        style={{ cursor: hasKids ? 'pointer' : 'default' }}
      >
        <td style={{ ...tdStyle('left'), padding: `9px 16px 9px ${16 + depth * 20}px` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              width: 14, display: 'flex', justifyContent: 'center', flexShrink: 0,
              color: T.ink4, transition: 'transform 140ms',
              transform: open ? 'rotate(90deg)' : 'none',
            }}>
              {hasKids ? <Icon name="chevron" size={11} sw={2} /> : null}
            </span>
            <Num
              color={depth === 0 ? T.ink : T.ink2}
              size={depth === 0 ? 12.5 : 12}
              weight={depth === 0 ? 600 : 450}
            >
              {label}
            </Num>
          </div>
        </td>
        <td style={{ ...tdStyle('right') }}>
          <Num color={c} size={12.5} weight={depth === 0 ? 600 : 460}>
            {money(node.balance, { cur })}
          </Num>
        </td>
      </tr>
      {open && hasKids && node.children.map(ch => (
        <BalRow
          key={ch.id}
          node={ch}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          cur={cur}
        />
      ))}
    </>
  );
}

// ── SectionHeading ───────────────────────────────────────────────────────────
// A full-width heading row separating stock figures (as-of the window end) from
// flow figures (movement across the window). Without it the two kinds of number
// sit side by side with nothing saying they answer different questions.
function SectionHeading({ label, note }) {
  return (
    <tr>
      <td colSpan={2} style={{
        padding: '16px 16px 6px', borderBottom: `1px solid ${T.line}`,
        background: T.surface, fontFamily: T.sans,
      }}>
        <span style={{
          fontSize: 10.5, fontWeight: 600, letterSpacing: '0.05em',
          textTransform: 'uppercase', color: T.ink2,
        }}>{label}</span>
        {note ? (
          <span style={{ fontSize: 10.5, fontWeight: 450, color: T.ink3, marginLeft: 8 }}>
            {note}
          </span>
        ) : null}
      </td>
    </tr>
  );
}

const SECTION_LABEL_KEY = {
  stocks: 'balance.section.stocks',
  flows: 'balance.section.flows',
  unclassified: 'balance.section.unclassified',
};

// ── BalanceView ──────────────────────────────────────────────────────────────
// `sections` is the grouped form from buildBalanceTree(); `roots` is the flat
// fallback kept for callers that do not group (and for the plain tree tests).
function BalanceView({ roots = [], netWorth = 0, cur, sections, rangeLabel }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = id => setExpanded(p => {
    const n = new Set(p);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const renderRows = (nodes) => nodes.map(n => (
    <BalRow key={n.id} node={n} depth={0} expanded={expanded} onToggle={toggle} cur={cur} />
  ));

  const body = sections && sections.length > 0
    ? sections.map(sec => (
        <React.Fragment key={sec.id}>
          <SectionHeading
            label={t(SECTION_LABEL_KEY[sec.id] || sec.id)}
            note={sec.id === 'flows' ? rangeLabel : null}
          />
          {renderRows(sec.roots)}
        </React.Fragment>
      ))
    : renderRows(roots);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: T.surface }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={thStyle('left')}>{t('table.account')}</th>
            <th style={thStyle('right')}>{t('tab.balance')}</th>
          </tr>
        </thead>
        <tbody>{body}</tbody>
        <tfoot>
          <tr style={{ background: T.surface2 }}>
            <td style={{
              padding: '13px 16px 13px 37px', fontSize: 12.5, fontWeight: 600,
              color: T.ink, fontFamily: T.sans, borderTop: `1.5px solid ${T.line2}`,
            }}>
              {t('balance.net_worth')}
            </td>
            <td style={{ padding: '13px 16px', textAlign: 'right', borderTop: `1.5px solid ${T.line2}` }}>
              <Num color={T.ink} size={14} weight={650}>
                {money(netWorth, { cur })}
              </Num>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export { BalanceView };
