/** @jest-environment jsdom */
const { render, screen } = require('@testing-library/react');
const React = require('react');
require('@testing-library/jest-dom');

test('RTL + jsdom render works', () => {
  render(React.createElement('h1', null, 'hi'));
  expect(screen.getByText('hi')).toBeInTheDocument();
});
