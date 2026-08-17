/** @jest-environment jsdom */
import { render, act } from '@testing-library/react';
const mockSetOption = jest.fn();
jest.mock('echarts', () => ({ init: () => ({ setOption: mockSetOption, resize() {}, dispose() {} }) }));
import { AreaLineChart } from '../src/charts/AreaLineChart';

const data = [
  { m: 'Jan', Assets: 60000, Liabilities: -5000 },
  { m: 'Feb', Assets: 62000, Liabilities: -4800 },
  { m: 'Mar', Assets: 61000, Liabilities: -4600 },
];
const series = [
  { key: 'Assets',      color: '#3E7E6C', label: 'Assets'      },
  { key: 'Liabilities', color: '#5B82A6', label: 'Liabilities' },
];

test('calls echarts setOption', () => {
  render(<AreaLineChart data={data} series={series} cur="USD" maxY={70000} grid={[0, 20000, 40000, 60000]} />);
  expect(mockSetOption).toHaveBeenCalled();
});

test('x-axis uses unique interval keys and sparse year/quarter tick labels', () => {
  const tickData = [
    { key: '2015-01', m: "Jan '15", tick: '2015', Assets: 1 },
    { key: '2015-04', m: 'Apr',     tick: 'Q2',   Assets: 2 },
    { key: '2016-01', m: "Jan '16", tick: '2016', Assets: 3 },
  ];
  render(<AreaLineChart data={tickData} series={[{ key: 'Assets', color: '#3E7E6C', label: 'Assets' }]} cur="USD" />);
  const opt = mockSetOption.mock.calls.at(-1)[0];
  expect(opt.xAxis.data).toEqual(['2015-01', '2015-04', '2016-01']);
  expect(opt.xAxis.axisLabel.interval).toBe(0);
  const f = opt.xAxis.axisLabel.formatter;
  expect(f('2015-01', 0)).toBe('2015');
  expect(f('2015-04', 1)).toBe('Q2');
});

test('setOption option contains both series keys', () => {
  render(<AreaLineChart data={data} series={series} cur="USD" maxY={70000} grid={[0, 20000, 40000, 60000]} />);
  const opt = mockSetOption.mock.calls[0][0];
  const json = JSON.stringify(opt);
  expect(json).toContain('Assets');
  expect(json).toContain('Liabilities');
});

test('setOption option contains series colors', () => {
  render(<AreaLineChart data={data} series={series} cur="USD" maxY={70000} grid={[0, 20000, 40000, 60000]} />);
  const opt = mockSetOption.mock.calls[0][0];
  const json = JSON.stringify(opt);
  expect(json).toContain('#3E7E6C');
  expect(json).toContain('#5B82A6');
});

test('renders a container div', () => {
  const { container } = render(<AreaLineChart data={data} series={series} cur="USD" maxY={70000} grid={[0, 20000, 40000, 60000]} />);
  expect(container.querySelector('div')).toBeTruthy();
});

test('container carries the rd-chart class', () => {
  const { container } = render(<AreaLineChart data={data} series={series} cur="USD" maxY={70000} grid={[0, 20000, 40000, 60000]} />);
  expect(container.querySelector('.rd-chart')).not.toBeNull();
});

// ── emphasised (net worth) series ────────────────────────────────────────────

const netSeries = [
  { key: 'Assets',      color: '#3E7E6C', label: 'Assets',      type: 'assets' },
  { key: 'Liabilities', color: '#AE5645', label: 'Liabilities', type: 'liabilities' },
  { key: '__net',       color: '#4B45B8', label: 'Net Worth',   type: 'net', emphasis: true },
];
const netData = [
  { m: 'Jan', Assets: 60000, Liabilities: -5000, __net: 55000 },
  { m: 'Feb', Assets: 62000, Liabilities: -4800, __net: 57200 },
];
const renderNet = () => {
  mockSetOption.mockClear();
  render(<AreaLineChart data={netData} series={netSeries} cur="USD" maxY={70000} minY={-10000} grid={[0, 20000, 40000, 60000]} />);
  return mockSetOption.mock.calls.at(-1)[0];
};

test('the emphasised series is drawn thicker and above the account lines', () => {
  const opt = renderNet();
  const net = opt.series.find(s => s.name === 'Net Worth');
  const account = opt.series.find(s => s.name === 'Assets');
  expect(net.lineStyle.width).toBeGreaterThan(account.lineStyle.width);
  expect(net.z).toBeGreaterThan(account.z);
});

test('only the emphasised series carries an area fill', () => {
  const opt = renderNet();
  expect(opt.series.find(s => s.name === 'Net Worth').areaStyle).toBeDefined();
  expect(opt.series.find(s => s.name === 'Assets').areaStyle).toBeUndefined();
  expect(opt.series.find(s => s.name === 'Liabilities').areaStyle).toBeUndefined();
});

test('tooltip reports the net-worth series value, it does not re-sum the series', () => {
  const opt = renderNet();
  const params = [
    { dataIndex: 1, seriesName: 'Assets',      value: 62000, color: '#3E7E6C' },
    { dataIndex: 1, seriesName: 'Liabilities', value: -4800, color: '#AE5645' },
    { dataIndex: 1, seriesName: 'Net Worth',   value: 57200, color: '#4B45B8' },
  ];
  const html = opt.tooltip.formatter(params);
  // 57200 once — a naive params.reduce would report 114400 (net counted twice)
  expect(html).toContain('57,200');
  expect(html).not.toContain('114,400');
  // and the net row is not repeated as an ordinary series row
  expect(html.match(/Net Worth/g)).toHaveLength(1);
});

test('the lead series is located by index, so an account of the same name is not mistaken for it', () => {
  // Series labels are bare account leaves ('Assets:Net Worth' → 'Net Worth'), so a
  // by-name lookup can latch onto an account row and report ITS value as the total.
  mockSetOption.mockClear();
  render(<AreaLineChart
    data={[{ m: 'Jan', a: 1000, __net: 600 }]}
    series={[
      { key: 'a',     color: '#2E7D62', label: 'Net Worth', type: 'assets' },
      { key: '__net', color: '#4B45B8', label: 'Net Worth', type: 'net', emphasis: true },
    ]}
    cur="USD" maxY={2000} minY={-1000}
  />);
  const opt = mockSetOption.mock.calls.at(-1)[0];
  const html = opt.tooltip.formatter([
    { dataIndex: 0, seriesIndex: 0, seriesName: 'Net Worth', value: 1000, color: '#2E7D62' },
    { dataIndex: 0, seriesIndex: 1, seriesName: 'Net Worth', value: 600,  color: '#4B45B8' },
  ]);
  // the footer (below the rule) reports the net series' 600, the account its 1,000
  const [rows, footer] = html.split('<hr');
  expect(rows).toContain('1,000');
  expect(footer).toContain('600');
});

test('a lone series (portfolio value) keeps its filled area and 2px line', () => {
  mockSetOption.mockClear();
  render(<AreaLineChart data={[{ m: 'Jan', value: 1000 }]} series={[{ key: 'value', color: '#2E7D62', label: 'Value' }]} cur="USD" maxY={2000} />);
  const only = mockSetOption.mock.calls.at(-1)[0].series[0];
  expect(only.areaStyle).toBeDefined();
  expect(only.lineStyle.width).toBe(2);
});

test('the zero line is drawn distinctly from the other gridlines', () => {
  const { T } = require('../src/ui/tokens');
  const opt = renderNet();
  const zero = opt.series.find(s => s.markLine);
  expect(zero).toBeDefined();
  // Zero is the reference a balance chart is read against — a hairline in the
  // gridline colour disappears among the gridlines.
  expect(zero.markLine.lineStyle.color).not.toBe(T.line);
  expect(zero.markLine.lineStyle.color).not.toBe(T.line2);
  expect(zero.markLine.lineStyle.color).toBe(T.ink4);
});

test('no zero line when the chart has no negative values', () => {
  mockSetOption.mockClear();
  render(<AreaLineChart data={[{ m: 'Jan', a: 100 }]} series={[{ key: 'a', color: '#2E7D62', label: 'A' }]} cur="USD" maxY={200} />);
  expect(mockSetOption.mock.calls.at(-1)[0].series.some(s => s.markLine)).toBe(false);
});

test('disables animation for the print (SVG) render so the chart is fully drawn, not empty', () => {
  mockSetOption.mockClear();
  render(<AreaLineChart data={data} series={series} cur="USD" maxY={70000} grid={[0, 20000, 40000, 60000]} />);
  expect(mockSetOption.mock.calls[0][0].animation).not.toBe(false);
  act(() => { window.dispatchEvent(new Event('beforeprint')); });
  expect(mockSetOption.mock.calls.at(-1)[0].animation).toBe(false);
});
