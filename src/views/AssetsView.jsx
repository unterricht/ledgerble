// AssetsView.jsx — Assets & Liabilities over time with area-line chart.
// Props: { vm, cur }
//   vm  — AssetsViewModel from buildAssets():
//         { data, series, maxY, minY, grid, totals, asOf }
//   cur — display currency string (e.g. 'USD')
//
// The summary strip reports the balance sheet, not a running list of accounts:
// net worth (assets minus liabilities — the figure a balance sheet calls equity),
// then the two gross sides. All three come from vm.totals, the single place where
// buildAssets computes them, so the strip can never disagree with the chart
// tooltip. Per-account figures live in the legend below the chart.
import React from 'react';
import { T, money } from '../ui/tokens';
import { Eyebrow, Num } from '../ui/controls';
import { AreaLineChart } from '../charts/AreaLineChart';
const { t, formatDate } = require('../../i18n');

const EMPTY_TOTALS = { assets: 0, liabilities: 0, net: 0 };

function AssetsView({ vm = { data: [], series: [], maxY: 0, grid: [0] }, cur = 'USD' }) {
  const { data, series, maxY, minY = 0, grid, totals = EMPTY_TOTALS, asOf = null } = vm;

  // Negative amounts carry an explicit minus sign here (a parenthesised
  // "(3.000 €)" reads as an accounting nicety, not as "subtracted from assets").
  const fmt = (v) => money(v, { cents: false, sign: v < 0, cur });

  const last = data.length > 0 ? data[data.length - 1] : null;
  const netSeries = series.find((s) => s.type === 'net');
  const accountSeries = series.filter((s) => s.type !== 'net');
  // Net worth leads the legend, mirroring the strip and the tooltip.
  const legendSeries = netSeries ? [netSeries, ...accountSeries] : accountSeries;

  const tiles = [
    {
      id: 'net',
      label: t('balance.net_worth'),
      // The date the figure refers to, in the platform's date format.
      note: asOf ? formatDate(asOf) : '',
      value: totals.net,
      color: T.net,
      lead: true,
    },
    { id: 'assets',      label: t('assets.total_assets'),      value: totals.assets,      color: T.pos },
    { id: 'liabilities', label: t('assets.total_liabilities'), value: totals.liabilities, color: T.neg },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.surface }}>
      {/* Summary strip — net worth, then the two gross sides */}
      <div data-testid="assets-strip" style={{ display: 'flex', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
        {tiles.map(({ id, label, note, value, color, lead }, i) => (
          <div
            key={id}
            data-testid={`tile-${id}`}
            style={{
              flex: 1,
              padding: '15px 22px',
              borderLeft: i ? `1px solid ${T.line}` : 'none',
            }}
          >
            <Eyebrow>{label}</Eyebrow>
            <div style={{ marginTop: 6 }}>
              <Num className="rd-stat-val" color={color} size={lead ? 24 : 20} weight={lead ? 620 : 560} style={{ letterSpacing: '-0.02em' }}>
                {fmt(value)}
              </Num>
            </div>
            {/* The as-of date sits under the value, not inside the label: a wrapped
                label would push this tile's figure out of line with the others. */}
            {note && (
              <div data-testid={`tile-${id}-asof`} style={{ marginTop: 3, fontSize: 11, color: T.ink3, fontFamily: T.sans }}>
                {note}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chart + legend */}
      <div style={{ flex: 1, padding: '20px 22px', overflow: 'auto' }}>
        <AreaLineChart data={data} series={series} cur={cur} maxY={maxY} minY={minY} grid={grid} />

        {/* Legend — identity is never colour alone: every entry is labelled and
            carries its current value, which doubles as the chart's data table. */}
        <div data-testid="assets-legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 22px', justifyContent: 'center', marginTop: 6 }}>
          {legendSeries.map((s) => {
            const value = last ? (last[s.key] || 0) : 0;
            const isNet = s.type === 'net';
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 16, height: isNet ? 3.5 : 2.5, borderRadius: 2, background: s.color }} />
                <span style={{ fontSize: 11.5, color: isNet ? T.ink : T.ink2, fontFamily: T.sans, fontWeight: isNet ? 600 : 450 }}>{s.label}</span>
                <span style={{ fontSize: 11.5, color: isNet ? T.ink : T.ink2, fontFamily: T.mono, fontWeight: isNet ? 600 : 500 }}>{fmt(value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { AssetsView };
