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
