// PortfolioView.jsx — Portfolio holdings with unrealised gain and total-value chart.
// Ported from Entwicklung/redesign/project/ui_kits/ledgerble/rd-views2.jsx (PortfolioView, lines ~134-183).
// Props: { vm, cur }
//   vm  — PortfolioViewModel from buildPortfolio(): { totals, holdings, totalCost, totalMarket, totalGain }
//   cur — display currency string (e.g. 'USD')
import React from 'react';
import { T, money } from '../ui/tokens';
import { Eyebrow, Num } from '../ui/controls';
import { AreaLineChart } from '../charts/AreaLineChart';
const { t } = require('../../i18n');

// Shared table cell styles (matching rd-views2.jsx thStyle/tdStyle)
function thStyle(align) {
  return {
    padding: '9px 16px',
    textAlign: align,
    fontSize: 11,
    fontWeight: 600,
    color: T.ink3,
    fontFamily: T.sans,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    borderBottom: `1px solid ${T.line}`,
    background: T.surface2,
    position: 'sticky',
    top: 0,
    zIndex: 1,
  };
}

function tdStyle(align) {
  return {
    padding: '10px 16px',
    textAlign: align,
    borderBottom: `1px solid ${T.line}`,
    verticalAlign: 'middle',
  };
}

function PortfolioView({ vm = { totals: [], holdings: [], totalCost: 0, totalMarket: 0, totalGain: 0, maxY: 0, grid: [0] }, cur = 'USD' }) {
  const { totals, holdings, totalCost, totalMarket, totalGain, maxY, grid } = vm;

  // Series for the AreaLineChart: single 'value' series
  const series = [{ key: 'value', color: T.pos, label: 'Portfolio value' }];

  // Summary strip: [Cost basis, Market value, Unrealised gain]
  const stripItems = [
    { label: t('portfolio.cost_basis'),      value: totalCost,   color: T.ink2, sign: false },
    { label: t('portfolio.market_value'),    value: totalMarket, color: T.ink,  sign: false },
    { label: t('portfolio.unrealised_gain'), value: totalGain,   color: totalGain >= 0 ? T.pos : T.neg, sign: true },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.surface }}>
      {/* Summary strip */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
        {stripItems.map(({ label, value, color, sign }, i) => (
          <div
            key={label}
            style={{
              flex: 1,
              padding: '15px 22px',
              borderLeft: i ? `1px solid ${T.line}` : 'none',
            }}
          >
            <Eyebrow>{label}</Eyebrow>
            <div style={{ marginTop: 6 }}>
              <Num color={color} size={20} weight={560} style={{ letterSpacing: '-0.02em' }}>
                {money(value, { cents: false, cur, sign })}
              </Num>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ padding: '14px 22px 4px', flexShrink: 0 }}>
        <AreaLineChart data={totals} series={series} cur={cur} maxY={maxY} grid={grid} />
      </div>

      {/* Holdings table */}
      <div style={{ flex: 1, overflowY: 'auto', borderTop: `1px solid ${T.line}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle('left')}>{t('table.account')}</th>
              <th style={thStyle('left')}>{t('table.asset')}</th>
              <th style={thStyle('right')}>{t('table.quantity')}</th>
              <th style={thStyle('right')}>{t('portfolio.cost_basis')}</th>
              <th style={thStyle('right')}>{t('portfolio.market_value')}</th>
              <th style={thStyle('right')}>{t('portfolio.unrealised_gain')}</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h, i) => {
              const pct = h.cost !== 0 ? Math.abs(h.gain / h.cost * 100).toFixed(1) : '0.0';
              const gainColor = h.gain >= 0 ? T.pos : T.neg;
              const pctSign = h.gain >= 0 ? '+' : '-';
              return (
                <tr key={i} className="rd-row">
                  <td style={tdStyle('left')}>
                    <Num color={T.ink2} size={11.5}>{h.account}</Num>
                  </td>
                  <td style={{ ...tdStyle('left'), fontFamily: T.sans, fontWeight: 600, color: T.ink, fontSize: 13 }}>
                    {h.asset}
                  </td>
                  <td style={tdStyle('right')}>
                    <Num color={T.ink3} size={12.5}>{h.qty != null ? Number(h.qty).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'}</Num>
                  </td>
                  <td style={tdStyle('right')}>
                    <Num color={T.ink2} size={12.5}>{money(h.cost, { cur })}</Num>
                  </td>
                  <td style={tdStyle('right')}>
                    <Num color={T.ink} size={12.5}>{money(h.market, { cur })}</Num>
                  </td>
                  <td style={tdStyle('right')}>
                    <Num color={gainColor} size={12.5} weight={520}>
                      {money(h.gain, { sign: true, cur })}{' '}
                      <span style={{ color: T.ink3, fontWeight: 400 }}>({pctSign}{pct}%)</span>
                    </Num>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: T.surface2 }}>
              <td colSpan={3} style={{ padding: '12px 16px', fontSize: 12.5, fontWeight: 600, color: T.ink, fontFamily: T.sans, borderTop: `1.5px solid ${T.line2}` }}>
                Total
              </td>
              <td style={{ ...tdStyle('right'), borderTop: `1.5px solid ${T.line2}` }}>
                <Num color={T.ink} size={12.5} weight={600}>{money(totalCost, { cur })}</Num>
              </td>
              <td style={{ ...tdStyle('right'), borderTop: `1.5px solid ${T.line2}` }}>
                <Num color={T.ink} size={12.5} weight={600}>{money(totalMarket, { cur })}</Num>
              </td>
              <td style={{ ...tdStyle('right'), borderTop: `1.5px solid ${T.line2}` }}>
                <Num color={totalGain >= 0 ? T.pos : T.neg} size={12.5} weight={600}>
                  {money(totalGain, { sign: true, cur })}
                </Num>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export { PortfolioView };
