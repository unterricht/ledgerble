// ExpensesIncomeView.jsx — Expenses / Income breakdown with Visual / Text toggle
// Ported from TreemapView in rd-views2.jsx (Task 4.3)
import React, { useState } from 'react';
import { BarBreakdown } from '../charts/BarBreakdown';
import { Segmented, Eyebrow, Num } from '../ui/controls';
import { T, money } from '../ui/tokens';
const { t } = require('../../i18n');

function ExpensesIncomeView({ tree, total, cur, kind }) {
  const [mode, setMode] = useState('bars');

  const flat = tree ? [...tree].sort((a, b) => b.value - a.value) : [];
  const safeTotal = total || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.surface }}>
      {/* ── header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 22px', borderBottom: `1px solid ${T.line}`, flexShrink: 0,
      }}>
        <div>
          <Eyebrow>{kind === 'income' ? t('expenses_income.eyebrow_income') : t('expenses_income.eyebrow_expenses')}</Eyebrow>
          <div style={{ marginTop: 5 }}>
            <Num color={T.ink} size={20} weight={580} style={{ letterSpacing: '-0.02em' }}>
              {money(total, { cents: false, cur })}
            </Num>
            <span style={{ fontSize: 12.5, color: T.ink3, fontFamily: T.sans, marginLeft: 8 }}>
              {kind === 'income'
                ? t('expenses_income.sub_sources').replace('{n}', flat.length)
                : t('expenses_income.sub_categories').replace('{n}', flat.length)}
            </span>
          </div>
        </div>
        <Segmented
          options={[{ value: 'bars', label: t('toggle.visual') }, { value: 'text', label: t('toggle.text') }]}
          value={mode}
          onChange={setMode}
          size="sm"
        />
      </div>

      {/* ── content ── */}
      {mode === 'bars' ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <BarBreakdown tree={tree} total={total} cur={cur} />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {flat.map((it, i) => (
                <tr key={it.name} className="rd-row">
                  <td style={{ padding: '12px 22px', borderBottom: `1px solid ${T.line}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: T.chart[i % T.chart.length] }} />
                      <span style={{ fontSize: 13, color: T.ink, fontFamily: T.sans }}>{it.label}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 22px', borderBottom: `1px solid ${T.line}`, textAlign: 'right', width: 120 }}>
                    <Num color={T.ink} size={12.5} weight={520}>{money(it.value, { cur })}</Num>
                  </td>
                  <td style={{ padding: '12px 22px 12px 0', borderBottom: `1px solid ${T.line}`, textAlign: 'right', width: 56 }}>
                    <Num color={T.ink3} size={12}>{Math.round(it.value / safeTotal * 100)}%</Num>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export { ExpensesIncomeView };
