import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { T, money, kfmt } from '../ui/tokens';

/**
 * IncomeExpensesChart — grouped income/expense bars + net line, ECharts re-themed
 * to the Quiet Ledger palette.
 *
 * Props:
 *   monthly       [{ m, inc, exp }]   month label + positive income/expense numbers
 *   netColor      string              line color for the net series (default T.net)
 *   cur           string              currency code passed to formatters
 *   onSelectMonth function(m)         optional click callback with the month label
 */
function IncomeExpensesChart({ monthly = [], netColor = '#7A47C2', cur = 'USD', onSelectMonth }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    const chart = echarts.init(ref.current);

    const months  = monthly.map(d => d.m);
    const incData = monthly.map(d => d.inc);
    const expData = monthly.map(d => d.exp);
    const netData = monthly.map(d => d.inc - d.exp);

    const option = {
      backgroundColor: 'transparent',
      grid: { top: 24, right: 16, bottom: 32, left: 58, containLabel: false },
      xAxis: {
        type: 'category',
        data: months,
        axisLine:  { lineStyle: { color: T.line2 } },
        axisTick:  { show: false },
        axisLabel: { color: T.ink3, fontFamily: T.sans, fontSize: 10.5 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine:  { show: false },
        axisTick:  { show: false },
        axisLabel: {
          color: T.ink4,
          fontFamily: T.mono,
          fontSize: 10.5,
          formatter: v => kfmt(v, cur),
        },
        splitLine: { lineStyle: { color: T.line, width: 1 } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: T.surface,
        borderColor: T.line,
        borderWidth: 1,
        textStyle: { color: T.ink, fontFamily: T.sans, fontSize: 11.5 },
        extraCssText: 'box-shadow: 0 8px 20px rgba(16,18,22,0.14); border-radius: 9px;',
        formatter(params) {
          const m = params[0]?.axisValueLabel ?? '';
          let inc = 0, exp = 0, net = 0;
          params.forEach(p => {
            if (p.seriesName === 'Income')   inc = p.value;
            if (p.seriesName === 'Expenses') exp = p.value;
            if (p.seriesName === 'Net')      net = p.value;
          });
          const negNet = net < 0;
          const dotStyle = c => `display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:6px;`;
          return `
            <div style="font-weight:600;margin-bottom:6px;font-family:${T.sans}">${m}</div>
            <div><span style="${dotStyle(T.pos)}"></span>Income <span style="float:right;margin-left:24px;font-family:${T.mono};font-weight:500">${money(inc, { cur })}</span></div>
            <div><span style="${dotStyle(T.neg)}"></span>Expenses <span style="float:right;margin-left:24px;font-family:${T.mono};font-weight:500">${money(exp, { cur })}</span></div>
            <hr style="border:none;border-top:1px solid ${T.line};margin:5px 0"/>
            <div><span style="${dotStyle(negNet ? T.neg : netColor)}"></span>${negNet ? 'Net loss' : 'Net'} <span style="float:right;margin-left:24px;font-family:${T.mono};font-weight:500">${money(net, { sign: true, cur })}</span></div>
          `.trim();
        },
      },
      series: [
        {
          name: 'Income',
          type: 'bar',
          data: incData,
          barMaxWidth: 18,
          itemStyle: { color: T.pos, borderRadius: [3, 3, 0, 0], opacity: 0.85 },
          emphasis: { itemStyle: { opacity: 1 } },
        },
        {
          name: 'Expenses',
          type: 'bar',
          data: expData,
          barMaxWidth: 18,
          itemStyle: { color: T.neg, borderRadius: [3, 3, 0, 0], opacity: 0.85 },
          emphasis: { itemStyle: { opacity: 1 } },
        },
        {
          name: 'Net',
          type: 'line',
          data: netData,
          // Color the net line using the passed-in netColor
          lineStyle: { color: netColor, width: 2.5, join: 'round', cap: 'round' },
          itemStyle: { color: netColor },
          symbol: 'circle',
          symbolSize: 6,
          smooth: false,
          areaStyle: {
            // Subtle tint under the net line using the netColor at low opacity
            color: netColor + '1A',
            opacity: 0.35,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: T.line2, width: 1.4, type: 'solid' },
            data: [{ yAxis: 0 }],
            label: { show: false },
          },
        },
      ],
    };

    chart.setOption(option);

    if (onSelectMonth) {
      chart.on('click', params => {
        if (params.name) onSelectMonth(params.name);
      });
    }

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [monthly, netColor, cur]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={ref} style={{ width: '100%', height: 280 }} />;
}

export { IncomeExpensesChart };
