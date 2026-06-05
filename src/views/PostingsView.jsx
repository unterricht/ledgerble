// PostingsView.jsx — Searchable, sortable transactions table.
// Ported from Entwicklung/redesign/project/ui_kits/ledgerble/rd-views.jsx lines ~251-321.
// Props: { rows, query, typeFilter, cur }
//   rows       — [{date, payee, account, amount, type}] from buildPostings()
//   query      — text search string ('' = no filter)
//   typeFilter — 'all' | type string matching p.type (Shell Segmented value)
//   cur        — display currency string
import React, { useState } from 'react';
import { T, money } from '../ui/tokens';
import { Num } from '../ui/controls';
const { t } = require('../../i18n');

// ── table style helpers (matching BalanceView pattern) ───────────────────────
const thStyle = (align = 'left') => ({
  padding: '10px 16px', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.05em',
  textTransform: 'uppercase', color: T.ink3, textAlign: align,
  borderBottom: `1px solid ${T.line}`, background: T.surface, position: 'sticky', top: 0,
  fontFamily: T.sans, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
});

const tdStyle = (align = 'left') => ({
  padding: '11px 16px', textAlign: align, borderBottom: `1px solid ${T.line}`,
  verticalAlign: 'middle',
});

// Badge map — covers design mock types (singular) and real app types (plural).
// POST_BADGE keys must cover whatever type strings actually flow through.
// Labels are functions to defer t() resolution until render time (locale may change).
const POST_BADGE = {
  // Design mock / Shell Segmented values (singular)
  income:   { bg: T.posSoft,   color: T.pos,   label: () => t('badge.income')    },
  expense:  { bg: T.negSoft,   color: T.neg,   label: () => t('badge.expense')   },
  asset:    { bg: T.steelSoft, color: T.steel, label: () => t('badge.asset')     },
  // Real app types from typeExtractor (plural)
  expenses:    { bg: T.negSoft,   color: T.neg,   label: () => t('badge.expense')   },
  assets:      { bg: T.steelSoft, color: T.steel, label: () => t('badge.asset')     },
  liabilities: { bg: T.negSoft,   color: T.neg,   label: () => t('badge.liability') },
  equity:      { bg: T.steelSoft, color: T.steel, label: () => t('badge.equity')    },
};

function postColor(type) {
  if (type === 'income')                 return T.pos;
  if (type === 'expense' || type === 'expenses') return T.neg;
  return T.steel;
}

function postAmt(p, cur) {
  if (p.type === 'income') return money(Math.abs(p.amount), { sign: true, cur });
  if (p.type === 'expense' || p.type === 'expenses') return '−' + money(p.amount, { cur });
  return money(p.amount, { sign: true, cur });
}

const { filterPostings, sortPostings } = require('../data/postingsFilter');

const COLUMNS = [
  { key: 'date',    label: () => t('table.date'),    align: 'left'  },
  { key: 'payee',   label: () => t('table.payee'),   align: 'left'  },
  { key: 'account', label: () => t('table.account'), align: 'left'  },
  { key: 'amount',  label: () => t('table.amount'),  align: 'right' },
  { key: 'type',    label: () => t('table.type'),    align: 'left'  },
];

function SortIndicator({ col, sortKey, sortDir }) {
  if (col !== sortKey) return <span style={{ color: T.ink4, marginLeft: 4 }}>⇅</span>;
  return <span style={{ color: T.pine, marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

function PostingsView({ rows = [], query = '', typeFilter = 'all', cur = 'USD' }) {
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  function handleHeaderClick(key) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = filterPostings(rows, query, typeFilter);
  const visible  = sortPostings(filtered, sortKey, sortDir);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: T.surface }}>
      {typeFilter === 'assets' && (
        <div style={{
          padding: '10px 18px', background: T.steelSoft, borderBottom: `1px solid ${T.line}`,
          fontSize: 12, color: T.ink2, fontFamily: T.sans, lineHeight: 1.5,
        }}>
          {t('postings.counterpart_note')}
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {COLUMNS.map(col => (
              <th
                key={col.key}
                style={thStyle(col.align)}
                onClick={() => handleHeaderClick(col.key)}
              >
                {col.label()}
                {col.key !== 'type' && (
                  <SortIndicator col={col.key} sortKey={sortKey} sortDir={sortDir} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((p, i) => {
            const b = POST_BADGE[p.type] || { bg: T.steelSoft, color: T.steel, label: () => p.type };
            return (
              <tr key={i} className="rd-row">
                <td style={tdStyle('left')}>
                  <Num color={T.ink3} size={12}>{p.date}</Num>
                </td>
                <td style={{ ...tdStyle('left'), color: T.ink, fontFamily: T.sans, fontSize: 13 }}>
                  {p.payee}
                </td>
                <td style={tdStyle('left')}>
                  <Num color={T.ink2} size={11.5}>{p.account}</Num>
                </td>
                <td style={tdStyle('right')}>
                  <Num color={postColor(p.type)} size={12.5} weight={520}>
                    {postAmt(p, cur)}
                  </Num>
                </td>
                <td style={tdStyle('left')}>
                  <span style={{
                    display: 'inline-block', padding: '2.5px 9px', borderRadius: 6,
                    fontSize: 10.5, fontWeight: 600,
                    background: b.bg, color: b.color, fontFamily: T.sans,
                  }}>
                    {b.label()}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {visible.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: T.ink4, fontSize: 13, fontFamily: T.sans }}>
          {t('postings.empty')}
        </div>
      )}
    </div>
  );
}

export { PostingsView };
