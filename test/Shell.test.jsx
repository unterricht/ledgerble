/** @jest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shell } from '../src/app/Shell';

beforeEach(() => {
  window.api = { onParsed: () => {}, settings: { getAll: async () => ({}), get: async () => [], set: () => {} },
                 windowControls: { minimize(){}, maximize(){}, close(){} }, platform: 'darwin' };
});

test('renders the source-list nav with all report items', () => {
  render(<Shell />);
  const nav = screen.getByRole('navigation');
  ['Income & Expenses','Balance','Expenses','Income','Assets & Liabilities','Portfolio','Postings','Options']
    .forEach(l => expect(within(nav).getByText(l)).toBeInTheDocument());
});

test('clicking a nav item switches the active view', async () => {
  render(<Shell />);
  await userEvent.click(within(screen.getByRole('navigation')).getByText('Balance'));
  expect(document.querySelector('[data-view="balance"]')).toBeInTheDocument();
});

test('macOS does not render custom window controls', () => {
  render(<Shell />);
  expect(screen.queryByTestId('win-controls')).not.toBeInTheDocument();
});

test('Windows renders custom window controls', () => {
  window.api.platform = 'win32';
  render(<Shell />);
  expect(screen.getByTestId('win-controls')).toBeInTheDocument();
});

test('typing in search switches to postings view', async () => {
  render(<Shell />);
  await userEvent.type(screen.getByPlaceholderText(/search/i), 'rent');
  expect(document.querySelector('[data-view="postings"]')).toBeInTheDocument();
});
