/** @jest-environment jsdom */
import { render } from '@testing-library/react';
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
