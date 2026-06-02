/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BarBreakdown } from '../src/charts/BarBreakdown';

const tree = [
  { name:'School', label:'School', value:1000, children:[ { name:'Eraser', label:'Eraser', value:1 } ] },
  { name:'Food', label:'Food', value:200 },
];
test('shows ranked categories and drills down to a not-itemised row', async () => {
  render(<BarBreakdown tree={tree} total={1200} cur="USD" />);
  expect(screen.getByText('School')).toBeInTheDocument();
  await userEvent.click(screen.getByText('School'));
  expect(screen.getByText('Eraser')).toBeInTheDocument();
  expect(screen.getByText(/not itemised/i)).toBeInTheDocument();
});
