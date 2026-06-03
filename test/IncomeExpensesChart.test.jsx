/** @jest-environment jsdom */
import { render } from '@testing-library/react';
const mockSetOption = jest.fn();
jest.mock('echarts', () => ({ init: () => ({ setOption: mockSetOption, resize(){}, dispose(){} }) }));
import { IncomeExpensesChart } from '../src/charts/IncomeExpensesChart';

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
