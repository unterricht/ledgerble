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
          let rows = params.map(p => {
            return `<div><span style="${dotStyle(p.color)}"></span>${p.seriesName} <span style="float:right;margin-left:24px;font-family:${T.mono};font-weight:500">${money(p.value, { cents: false, cur })}</span></div>`;
          });
          const total = params.reduce((a, p) => a + (p.value || 0), 0);
          return `
            <div style="font-weight:600;margin-bottom:6px;font-family:${T.sans}">${m}</div>
            ${rows.join('')}
            <hr style="border:none;border-top:1px solid ${T.line};margin:5px 0"/>
            <div style="font-family:${T.sans};font-weight:500">Total <span style="float:right;margin-left:24px;font-family:${T.mono};font-weight:600">${money(total, { cents: false, cur })}</span></div>
          `.trim();
        },
      },
      series: series.map(s => ({
        name: s.label,
        type: 'line',
        data: data.map(d => d[s.key] || 0),
        smooth: false,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
        emphasis: { focus: 'series', scale: true },
        lineStyle: { color: s.color, width: 2, join: 'round', cap: 'round' },
        itemStyle: { color: s.color },
        areaStyle: {
          color: s.color + '18',
          opacity: 1,
        },
      })),
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
  }, [data, series, cur, maxY]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={ref} className="rd-chart" style={{ width: '100%', height: 280 }} />;
}

export { AreaLineChart };
