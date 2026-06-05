import React from 'react';
import { BarBreakdown } from '../charts/BarBreakdown';
import { Eyebrow, Num } from '../ui/controls';
import { T, money } from '../ui/tokens';
const { t } = require('../../i18n');

function ExpensesIncomeView({ tree, total, cur, kind }) {
  const flat = tree ? [...tree].sort((a, b) => b.value - a.value) : [];

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
      </div>

      {/* ── content ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <BarBreakdown tree={tree} total={total} cur={cur} />
      </div>
    </div>
  );
}

export { ExpensesIncomeView };
