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

test('typing a valid interval in the from-box and pressing Enter updates the range', () => {
  const onChange = jest.fn();
  render(<DateRangeSlider intervals={intervals} value={[0, 3]} onChange={onChange} />);
  const fromInput = screen.getByDisplayValue('2018-01');
  fireEvent.change(fromInput, { target: { value: '2018-02' } });
  fireEvent.keyDown(fromInput, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith(1, 3);
});

test('typing a valid interval in the to-box and pressing Enter updates the range', () => {
  const onChange = jest.fn();
  render(<DateRangeSlider intervals={intervals} value={[0, 3]} onChange={onChange} />);
  const toInput = screen.getByDisplayValue('2018-04');
  fireEvent.change(toInput, { target: { value: '2018-03' } });
  fireEvent.keyDown(toInput, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith(0, 2);
});

test('typing an unknown value and pressing Enter does not call onChange', () => {
  const onChange = jest.fn();
  render(<DateRangeSlider intervals={intervals} value={[0, 3]} onChange={onChange} />);
  const fromInput = screen.getByDisplayValue('2018-01');
  fireEvent.change(fromInput, { target: { value: '9999-99' } });
  fireEvent.keyDown(fromInput, { key: 'Enter' });
  expect(onChange).not.toHaveBeenCalled();
});

test('monthly: typing unpadded month "2018-2" normalizes to "2018-02" and updates range', () => {
  const onChange = jest.fn();
  render(<DateRangeSlider intervals={intervals} value={[0, 3]} onChange={onChange} />);
  const fromInput = screen.getByDisplayValue('2018-01');
  fireEvent.change(fromInput, { target: { value: '2018-2' } });
  fireEvent.keyDown(fromInput, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith(1, 3);
});

test('daily: typing "2022-1-5" normalizes to "2022-01-05" and updates range', () => {
  const daily = ['2022-01-01', '2022-01-05', '2022-01-10'];
  const onChange = jest.fn();
  render(<DateRangeSlider intervals={daily} value={[0, 2]} onChange={onChange} />);
  const toInput = screen.getByDisplayValue('2022-01-10');
  fireEvent.change(toInput, { target: { value: '2022-1-5' } });
  fireEvent.keyDown(toInput, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith(0, 1);
});

test('weekly: typing "2026-4" normalizes to "2026-04" and updates range', () => {
  const weekly = ['2026-01', '2026-04', '2026-08'];
  const onChange = jest.fn();
  render(<DateRangeSlider intervals={weekly} value={[0, 2]} onChange={onChange} />);
  const fromInput = screen.getByDisplayValue('2026-01');
  fireEvent.change(fromInput, { target: { value: '2026-4' } });
  fireEvent.keyDown(fromInput, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith(1, 2);
});

test('pressing Escape in the from-box reverts the draft without calling onChange', () => {
  const onChange = jest.fn();
  render(<DateRangeSlider intervals={intervals} value={[0, 3]} onChange={onChange} />);
  const fromInput = screen.getByDisplayValue('2018-01');
  fireEvent.change(fromInput, { target: { value: '2018-02' } });
  fireEvent.keyDown(fromInput, { key: 'Escape' });
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByDisplayValue('2018-01')).toBeInTheDocument();
});

test('tabbing/clicking away from the from-box after typing a valid interval commits the change', () => {
  const onChange = jest.fn();
  render(<DateRangeSlider intervals={intervals} value={[0, 3]} onChange={onChange} />);
  const fromInput = screen.getByDisplayValue('2018-01');
  fireEvent.change(fromInput, { target: { value: '2018-02' } });
  fireEvent.blur(fromInput);
  expect(onChange).toHaveBeenCalledWith(1, 3);
});

test('tabbing/clicking away from the to-box after typing a valid interval commits the change', () => {
  const onChange = jest.fn();
  render(<DateRangeSlider intervals={intervals} value={[0, 3]} onChange={onChange} />);
  const toInput = screen.getByDisplayValue('2018-04');
  fireEvent.change(toInput, { target: { value: '2018-03' } });
  fireEvent.blur(toInput);
  expect(onChange).toHaveBeenCalledWith(0, 2);
});

test('blurring the from-box with an unchanged/invalid draft does not call onChange', () => {
  const onChange = jest.fn();
  render(<DateRangeSlider intervals={intervals} value={[0, 3]} onChange={onChange} />);
  const fromInput = screen.getByDisplayValue('2018-01');
  fireEvent.blur(fromInput);
  expect(onChange).not.toHaveBeenCalled();
});
