/** @jest-environment jsdom */
import { render } from '@testing-library/react';
import { Shell } from '../src/app/Shell';
beforeEach(() => { window.api = { onParsed(){}, settings:{getAll:async()=>({}),get:async()=>[],set(){}},
  windowControls:{minimize(){},maximize(){},close(){}}, platform:'darwin' }; window.print = jest.fn(); });
test('Cmd+P triggers window.print', () => {
  render(<Shell />);
  const e = new KeyboardEvent('keydown', { key:'p', metaKey:true });
  window.dispatchEvent(e);
  expect(window.print).toHaveBeenCalled();
});
