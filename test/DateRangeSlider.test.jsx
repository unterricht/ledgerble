/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangeSlider } from '../src/ui/controls';

const intervals = ['2018-01', '2018-02', '2018-03', '2018-04'];

test('shows the current from/to interval bounds', () => {
  render(<DateRangeSlider intervals={intervals} value={[0, 3]} onChange={() => {}} />);
  expect(screen.getByDisplayValue('2018-01')).toBeInTheDocument();
  expect(screen.getByDisplayValue('2018-04')).toBeInTheDocument();
});

test('dragging the lower thumb reports a new from index', () => {
  const onChange = jest.fn();
  render(<DateRangeSlider intervals={intervals} value={[0, 3]} onChange={onChange} />);
  fireEvent.change(screen.getByTestId('range-from'), { target: { value: '1' } });
  expect(onChange).toHaveBeenCalledWith(1, 3);
});

test('dragging the upper thumb reports a new to index', () => {
  const onChange = jest.fn();
  render(<DateRangeSlider intervals={intervals} value={[0, 3]} onChange={onChange} />);
  fireEvent.change(screen.getByTestId('range-to'), { target: { value: '2' } });
  expect(onChange).toHaveBeenCalledWith(0, 2);
});

test('lower thumb cannot cross above the upper thumb', () => {
  const onChange = jest.fn();
  render(<DateRangeSlider intervals={intervals} value={[0, 2]} onChange={onChange} />);
  fireEvent.change(screen.getByTestId('range-from'), { target: { value: '3' } });
  // clamped to the current upper bound (2), never above it
  expect(onChange).toHaveBeenCalledWith(2, 2);
});

test('renders without crashing for an empty interval list', () => {
  render(<DateRangeSlider intervals={[]} value={[0, 0]} onChange={() => {}} />);
  // both range inputs still present (disabled)
  expect(screen.getByTestId('range-from')).toBeDisabled();
});
