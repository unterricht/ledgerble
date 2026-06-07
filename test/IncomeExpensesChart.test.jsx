/** @jest-environment jsdom */
import { render, act } from '@testing-library/react';
const mockSetOption = jest.fn();
const mockInit = jest.fn(() => ({ setOption: mockSetOption, resize(){}, dispose(){}, on(){} }));
jest.mock('echarts', () => ({ init: (...a) => mockInit(...a) }));
import { IncomeExpensesChart } from '../src/charts/IncomeExpensesChart';

beforeEach(() => { mockInit.mockClear(); mockSetOption.mockClear(); });

test('feeds income/expense/net series to echarts with the purple net color', () => {
  render(<IncomeExpensesChart monthly={[{m:'Jan',inc:1000,exp:200}]} netColor="#7A47C2" cur="USD" />);
  expect(mockSetOption).toHaveBeenCalled();
  const opt = mockSetOption.mock.calls[0][0];
  const json = JSON.stringify(opt);
  expect(json).toContain('#7A47C2');
});

test('x-axis uses unique interval keys and sparse year/quarter tick labels', () => {
  const monthly = [
    { key: '2015-01', m: "Jan '15", tick: '2015', inc: 1, exp: 0 },
    { key: '2015-02', m: 'Feb',     tick: '',     inc: 1, exp: 0 },
    { key: '2015-04', m: 'Apr',     tick: 'Q2',   inc: 1, exp: 0 },
  ];
  render(<IncomeExpensesChart monthly={monthly} cur="USD" />);
  const opt = mockSetOption.mock.calls.at(-1)[0];
  // category data is the unique key, not the (possibly repeating) display label
  expect(opt.xAxis.data).toEqual(['2015-01', '2015-02', '2015-04']);
  // all candidates considered; blanks suppress clutter
  expect(opt.xAxis.axisLabel.interval).toBe(0);
  const f = opt.xAxis.axisLabel.formatter;
  expect(f('2015-01', 0)).toBe('2015');
  expect(f('2015-02', 1)).toBe('');
  expect(f('2015-04', 2)).toBe('Q2');
});

test('chart container carries the rd-chart class so print CSS can size it down', () => {
  const { container } = render(<IncomeExpensesChart monthly={[{m:'Jan',inc:1,exp:0}]} cur="USD" />);
  expect(container.querySelector('.rd-chart')).not.toBeNull();
});

test('renders with the canvas renderer on screen, switches to crisp SVG for print', () => {
  render(<IncomeExpensesChart monthly={[{m:'Jan',inc:1,exp:0}]} cur="USD" />);
  // initial mount uses canvas (fast, animated on screen)
  expect(mockInit).toHaveBeenLastCalledWith(expect.anything(), null, { renderer: 'canvas' });

  // beforeprint re-inits as SVG so the printed chart is vector-crisp
  act(() => { window.dispatchEvent(new Event('beforeprint')); });
  expect(mockInit).toHaveBeenLastCalledWith(expect.anything(), null, { renderer: 'svg' });

  // afterprint restores the canvas renderer
  act(() => { window.dispatchEvent(new Event('afterprint')); });
  expect(mockInit).toHaveBeenLastCalledWith(expect.anything(), null, { renderer: 'canvas' });
});

test('disables animation for the print (SVG) render so the chart is fully drawn, not empty', () => {
  render(<IncomeExpensesChart monthly={[{m:'Jan',inc:1,exp:0}]} cur="USD" />);
  // on screen: animation left at its default (truthy/undefined)
  expect(mockSetOption.mock.calls[0][0].animation).not.toBe(false);
  // print: re-rendered with animation disabled
  act(() => { window.dispatchEvent(new Event('beforeprint')); });
  expect(mockSetOption.mock.calls.at(-1)[0].animation).toBe(false);
});
