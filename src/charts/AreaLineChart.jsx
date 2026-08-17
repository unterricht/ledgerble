import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { T, money, kfmt } from '../ui/tokens';

/**
 * AreaLineChart — stacked/overlaid area lines with crosshair tooltip, ECharts re-theme.
 * Ported from rd-charts.jsx AreaLineChart (lines ~99-155), adapted to use ECharts.
 *
 * Props:
 *   data    [{ m, <key>: value, … }]   interval label + per-series values
 *   series  [{ key, color, label }]    series descriptors (one per account)
 *   cur     string                     currency code for formatters
 *   maxY    number                     max y-axis value (for scale)
 *   grid    number[]                   y-axis gridline values
 */
function AreaLineChart({ data = [], series = [], cur = 'USD', maxY = 0, minY = 0, grid = [] }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    // category = unique interval key; axis shows sparse year/quarter ticks; tooltip the full label.
    const months = data.map(d => d.key != null ? d.key : d.m);
    const ticks = data.map(d => d.tick !== undefined ? d.tick : (d.m != null ? d.m : ''));
    const tipLabels = data.map(d => d.m != null ? d.m : (d.key != null ? d.key : ''));

    // Series flagged `emphasis` lead the chart: they are a total of the others,
    // so the tooltip reports them as its footer instead of as one row among many.
    // Located by position, not by name — labels are bare account leaves and can
    // legitimately repeat.
    const leadIndex = series.findIndex(s => s.emphasis);
    const leadLabel = leadIndex >= 0 ? series[leadIndex].label : null;
    // Negatives read as "−3.000 €", matching the summary strip and legend.
    const fmt = (v) => money(v || 0, { cents: false, sign: (v || 0) < 0, cur });

    const option = {
      backgroundColor: 'transparent',
      grid: { top: 24, right: 16, bottom: 32, left: 62, containLabel: false },
      xAxis: {
        type: 'category',
        data: months,
        boundaryGap: false,
        axisLine:  { lineStyle: { color: T.line2 } },
        axisTick:  { show: false },
        axisLabel: { color: T.ink3, fontFamily: T.sans, fontSize: 10.5, interval: 0, formatter: (val, idx) => ticks[idx] != null ? ticks[idx] : '' },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: minY || 0,
        max: maxY || undefined,
        axisLine:  { show: false },
        axisTick:  { show: false },
        axisLabel: {
          color: T.ink4,
          fontFamily: T.mono,
          fontSize: 10.5,
          formatter: v => kfmt(v, cur),
        },
        splitLine: {
          lineStyle: { color: T.line, width: 1 },
        },
        splitNumber: grid.length > 1 ? grid.length - 1 : 4,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: { color: T.line2, width: 1, type: 'dashed' },
        },
        backgroundColor: T.surface,
        borderColor: T.line,
        borderWidth: 1,
        textStyle: { color: T.ink, fontFamily: T.sans, fontSize: 11.5 },
        extraCssText: 'box-shadow: 0 8px 20px rgba(16,18,22,0.14); border-radius: 9px;',
        formatter(params) {
          if (!params || !params.length) return '';
          const di = params[0]?.dataIndex;
          const m = (di != null && tipLabels[di] != null) ? tipLabels[di] : (params[0]?.axisValueLabel ?? '');
          const dotStyle = c =>
            `display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:6px;`;
          // The lead series is a total OF the others (net worth). It is reported
          // once, in the footer — summing all rows would count it twice.
          const leadParam = leadIndex >= 0
            ? params.find(p => (p.seriesIndex != null ? p.seriesIndex === leadIndex : p.seriesName === leadLabel))
            : null;
          const rows = params
            .filter(p => p !== leadParam)
            .sort((a, b) => Math.abs(b.value || 0) - Math.abs(a.value || 0))
            .map(p =>
              `<div><span style="${dotStyle(p.color)}"></span>${p.seriesName} <span style="float:right;margin-left:24px;font-family:${T.mono};font-weight:500">${fmt(p.value)}</span></div>`
            );
          const totalLabel = leadParam ? leadParam.seriesName : 'Total';
          const totalValue = leadParam
            ? (leadParam.value || 0)
            : params.reduce((a, p) => a + (p.value || 0), 0);
          return `
            <div style="font-weight:600;margin-bottom:6px;font-family:${T.sans}">${m}</div>
            ${rows.join('')}
            <hr style="border:none;border-top:1px solid ${T.line};margin:5px 0"/>
            <div style="font-family:${T.sans};font-weight:500">${totalLabel} <span style="float:right;margin-left:24px;font-family:${T.mono};font-weight:600">${fmt(totalValue)}</span></div>
          `.trim();
        },
      },
      // A lead series (net worth) reads as the headline: thicker, on top, filled.
      // Alongside it the account lines stay thin and unfilled — stacking five
      // translucent areas turns the plot to mud and hides where lines cross.
      series: series.map((s, i) => {
        const lead = !!s.emphasis;
        // A chart with a single line (the portfolio value) has nothing to compete
        // with, so it keeps the filled-area treatment at its original weight.
        const filled = lead || series.length === 1;
        const spec = {
          name: s.label,
          type: 'line',
          data: data.map(d => d[s.key] || 0),
          smooth: false,
          symbol: 'circle',
          symbolSize: lead ? 6 : 4,
          showSymbol: false,
          z: lead ? 4 : 2,
          emphasis: { focus: 'series', scale: true },
          lineStyle: { color: s.color, width: lead ? 3 : (filled ? 2 : 1.75), join: 'round', cap: 'round' },
          itemStyle: { color: s.color },
        };
        if (filled) spec.areaStyle = { color: s.color + (lead ? '14' : '18'), opacity: 1 };
        // Zero is the reference for a balance sheet: mark it once, on the first
        // series, and only when the plot actually crosses into negative values.
        if (i === 0 && (minY || 0) < 0) {
          spec.markLine = {
            silent: true,
            symbol: 'none',
            label: { show: false },
            data: [{ yAxis: 0 }],
            lineStyle: { color: T.ink4, width: 1, type: 'solid' },
          };
        }
        return spec;
      }),
    };

    // Canvas renders fast and animates on screen; SVG prints vector-crisp.
    // Swap the renderer around print so the printed chart isn't a blurry raster.
    let chart;
    const mount = (renderer) => {
      chart = echarts.init(ref.current, null, { renderer });
      // SVG = print: disable animation so the snapshot is fully drawn, not a frame-0 empty chart
      chart.setOption(renderer === 'svg' ? { ...option, animation: false } : option);
    };
    mount('canvas');

    const handleResize = () => chart.resize();
    const toSvg = () => { chart.dispose(); mount('svg'); };
    const toCanvas = () => { chart.dispose(); mount('canvas'); };
    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeprint', toSvg);
    window.addEventListener('afterprint', toCanvas);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeprint', toSvg);
      window.removeEventListener('afterprint', toCanvas);
      chart.dispose();
    };
  }, [data, series, cur, maxY, minY]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={ref} className="rd-chart" style={{ width: '100%', height: 280 }} />;
}

export { AreaLineChart };
