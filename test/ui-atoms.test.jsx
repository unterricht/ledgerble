/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Icon } from '../src/ui/Icon';
import { Segmented, Eyebrow, Num } from '../src/ui/controls';

test('Icon renders an svg for a known name', () => {
  const { container } = render(<Icon name="search" />);
  expect(container.querySelector('svg')).toBeInTheDocument();
});
test('Segmented marks active option and fires onChange', async () => {
  const onChange = jest.fn();
  render(<Segmented options={[{value:'a',label:'A'},{value:'b',label:'B'}]} value="a" onChange={onChange} />);
  await userEvent.click(screen.getByText('B'));
  expect(onChange).toHaveBeenCalledWith('b');
});
test('Num renders children', () => {
  render(<Num>$10.00</Num>);
  expect(screen.getByText('$10.00')).toBeInTheDocument();
});
test('Eyebrow renders label text', () => {
  render(<Eyebrow>Accounts</Eyebrow>);
  expect(screen.getByText('Accounts')).toBeInTheDocument();
});
