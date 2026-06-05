// AssetsView.jsx — Assets & Liabilities over time with area-line chart.
// Ported from Entwicklung/redesign/project/ui_kits/ledgerble/rd-views2.jsx (AssetsView, lines ~95-126).
// Props: { vm, cur }
//   vm  — AssetsViewModel from buildAssets(): { data, series, maxY, grid }
//   cur — display currency string (e.g. 'USD')
import React from 'react';
import { T, money } from '../ui/tokens';
import { Eyebrow, Num } from '../ui/controls';
import { AreaLineChart } from '../charts/AreaLineChart';
const { t } = require('../../i18n');

function AssetsView({ vm = { data: [], series: [], maxY: 0, grid: [0] }, cur = 'USD' }) {
  const { data, series, maxY, minY = 0, grid } = vm;

  // Compute the last data point for the summary strip totals
  const last = data.length > 0 ? data[data.length - 1] : null;

  // Total assets = sum of asset-type series only (liabilities are excluded so this
  // does not conflate net worth with gross assets, matching the design mockup).
  const total = last
    ? series.filter(s => s.type === 'assets').reduce((acc, s) => acc + (last[s.key] || 0), 0)
    : 0;

  // Summary strip: Total assets first, then one tile per series
  const stripItems = [
    { label: t('assets.total_assets'), value: total, color: T.ink },
    ...series.map(s => ({
      label: s.label,
      value: last ? (last[s.key] || 0) : 0,
      color: s.color,
    })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.surface }}>
      {/* Summary strip */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
        {stripItems.map(({ label, value, color }, i) => (
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
                {money(value, { cents: false, cur })}
              </Num>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + legend */}
      <div style={{ flex: 1, padding: '20px 22px', overflow: 'auto' }}>
        <AreaLineChart data={data} series={series} cur={cur} maxY={maxY} minY={minY} grid={grid} />

        {/* Legend */}
        <div style={{ display: 'flex', gap: 22, justifyContent: 'center', marginTop: 6 }}>
          {series.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 16, height: 2.5, borderRadius: 2, background: s.color }} />
              <span style={{ fontSize: 11.5, color: T.ink2, fontFamily: T.sans }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { AssetsView };
