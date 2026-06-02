// OverviewView.jsx — Income & Expenses overview, ported from rd-views.jsx
import React, { useState } from 'react';
import { IncomeExpensesChart } from '../charts/IncomeExpensesChart';
import { pickCats, RULE_LABEL } from '../data/pickCats';
import { T, money, kfmt } from '../ui/tokens';
import { Eyebrow, Num } from '../ui/controls';

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

// ── StatStrip ────────────────────────────────────────────────────────────────
function StatStrip({ statStrip, categoryCount, cur }) {
  const { income, expenses, net, savingsRate } = statStrip;
  const stats = [
    { label: 'Income',       value: money(income,   { cents: false, cur }), color: T.pos, sub: 'period total' },
    { label: 'Expenses',     value: money(expenses, { cents: false, cur }), color: T.neg, sub: `across ${categoryCount} categories` },
    { label: 'Net saved',    value: money(net,      { cents: false, sign: true, cur }), color: net < 0 ? T.neg : T.net, sub: 'income − expenses' },
    { label: 'Savings rate', value: savingsRate + '%', color: net < 0 ? T.neg : T.net, sub: 'of income kept' },
  ];
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
      {stats.map((s, i) => (
        <div key={s.label} style={{ flex: 1, padding: '16px 22px', borderLeft: i ? `1px solid ${T.line}` : 'none' }}>
          <Eyebrow>{s.label}</Eyebrow>
          <div style={{ marginTop: 7 }}>
            <Num color={s.color} weight={560} size={25} style={{ letterSpacing: '-0.02em' }}>{s.value}</Num>
          </div>
          <div style={{ fontSize: 11.5, color: T.ink3, fontFamily: T.sans, marginTop: 3 }}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── OverviewView ─────────────────────────────────────────────────────────────
function OverviewView({ vm, cur, netColor = T.net, catRule = 'top5' }) {
  const [showAll, setShowAll] = useState(false);
  const effRule = showAll ? 'all' : catRule;
  const { shown, rest } = pickCats(vm.expenses, effRule);
  const restTotal = rest.reduce((a, c) => a + c.total, 0);

  const expRow = (r, key) => (
    <tr key={key} className="rd-row">
      <td style={tdStyle('left')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: T.neg, flexShrink: 0 }} />
          <Num color={T.ink2} size={12} weight={450}>{r.cat}</Num>
        </div>
      </td>
      <td style={tdStyle('right')}><Num color={T.ink2} size={12.5}>{money(r.avg, { cur })}</Num></td>
      <td style={tdStyle('right')}><Num color={T.ink3} size={12.5}>{money(r.max, { cur })}</Num></td>
      <td style={tdStyle('right')}><Num color={T.ink3} size={12.5}>{money(r.min, { cur })}</Num></td>
      <td style={tdStyle('right')}><Num color={T.neg} size={12.5} weight={560}>{money(r.total, { cur })}</Num></td>
    </tr>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.surface, overflow: 'hidden' }}>
      <StatStrip statStrip={vm.statStrip} categoryCount={vm.categoryCount} cur={cur} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '20px 22px 8px' }}>
          <IncomeExpensesChart monthly={vm.monthly} netColor={netColor} cur={cur} />
          {/* legend */}
          <div style={{ display: 'flex', gap: 22, justifyContent: 'center', marginTop: 4 }}>
            {[['Income', T.pos, 'bar'], ['Expenses', T.neg, 'bar'], ['Net', netColor, 'line']].map(([l, c, k]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: k === 'line' ? 16 : 10, height: k === 'line' ? 2.5 : 10, borderRadius: k === 'line' ? 2 : 3, background: c }} />
                <span style={{ fontSize: 11.5, color: T.ink2, fontFamily: T.sans }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        {/* summary table */}
        <div style={{ padding: '4px 6px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 16px 8px' }}>
            <Eyebrow>Largest categories</Eyebrow>
            <span style={{ fontSize: 11, color: T.ink4, fontFamily: T.sans }}>
              {effRule === 'all'
                ? `All ${vm.categoryCount} expense categories`
                : `${RULE_LABEL[catRule]} of ${vm.categoryCount} expense categories`}
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>
              <th style={thStyle('left')}>Account</th>
              <th style={thStyle('right')}>Avg / mo</th>
              <th style={thStyle('right')}>Max</th>
              <th style={thStyle('right')}>Min</th>
              <th style={thStyle('right')}>Total</th>
            </tr></thead>
            <tbody>
              {/* income rows first */}
              {vm.income.map((r, i) => (
                <tr key={'inc' + i} className="rd-row">
                  <td style={tdStyle('left')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: T.pos, flexShrink: 0 }} />
                      <Num color={T.ink2} size={12} weight={450}>{r.cat}</Num>
                    </div>
                  </td>
                  <td style={tdStyle('right')}><Num color={T.ink2} size={12.5}>{money(r.avg, { cur })}</Num></td>
                  <td style={tdStyle('right')}><Num color={T.ink3} size={12.5}>{money(r.max, { cur })}</Num></td>
                  <td style={tdStyle('right')}><Num color={T.ink3} size={12.5}>{money(r.min, { cur })}</Num></td>
                  <td style={tdStyle('right')}><Num color={T.pos} size={12.5} weight={560}>{money(r.total, { cur })}</Num></td>
                </tr>
              ))}
              {shown.map((r, i) => expRow(r, 'exp' + i))}
              {rest.length > 0 && (
                <tr className="rd-row" onClick={() => setShowAll(true)} style={{ cursor: 'pointer' }}>
                  <td style={tdStyle('left')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: T.ink4, flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, color: T.ink2, fontFamily: T.sans, fontWeight: 500 }}>Other</span>
                      <span style={{ fontSize: 11, color: T.pine, fontFamily: T.sans }}>· show {rest.length} more</span>
                    </div>
                  </td>
                  <td style={tdStyle('right')}><Num color={T.ink4} size={12.5}>—</Num></td>
                  <td style={tdStyle('right')}><Num color={T.ink4} size={12.5}>—</Num></td>
                  <td style={tdStyle('right')}><Num color={T.ink4} size={12.5}>—</Num></td>
                  <td style={tdStyle('right')}><Num color={T.neg} size={12.5} weight={560}>{money(restTotal, { cur })}</Num></td>
                </tr>
              )}
              {showAll && catRule !== 'all' && (
                <tr className="rd-row" onClick={() => setShowAll(false)} style={{ cursor: 'pointer' }}>
                  <td colSpan={5} style={{ ...tdStyle('left'), color: T.pine, fontFamily: T.sans, fontSize: 12, fontWeight: 500 }}>
                    Collapse to {RULE_LABEL[catRule].toLowerCase()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export { OverviewView };
