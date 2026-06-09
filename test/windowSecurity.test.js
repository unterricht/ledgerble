/**
 * Tests for windowSecurity.js — defense-in-depth navigation hardening.
 *
 * The renderer only ever loads the bundled local index.html and renders
 * user-supplied data (account names, notes). To stop a stray link or injected
 * markup from navigating the app frame to a remote origin or spawning an
 * Electron window with Node-less-but-still-privileged context, we:
 *   - deny every window.open / target=_blank (action: 'deny')
 *   - block in-frame navigation away from the loaded file:// document
 * and route genuine http(s) links to the user's real browser instead.
 *
 * The module is pure: electron's `shell` is injected so it unit-tests without
 * a running Electron.
 */
const { hardenWindowSecurity } = require('../windowSecurity');

function fakeContents() {
  const handlers = {};
  return {
    setWindowOpenHandler: jest.fn(),
    on: jest.fn((event, cb) => { handlers[event] = cb; }),
    emit: (event, ...args) => handlers[event] && handlers[event](...args),
    openHandler: () => fakeContents,
  };
}

describe('hardenWindowSecurity', () => {
  let contents, shell;
  beforeEach(() => {
    contents = fakeContents();
    shell = { openExternal: jest.fn() };
    hardenWindowSecurity(contents, shell);
  });

  describe('window.open / new windows', () => {
    const openHandler = () => contents.setWindowOpenHandler.mock.calls[0][0];

    it('denies every requested new window', () => {
      expect(openHandler()({ url: 'https://example.com' })).toEqual({ action: 'deny' });
      expect(openHandler()({ url: 'file:///somewhere/evil.html' })).toEqual({ action: 'deny' });
    });

    it('opens http(s) targets in the real browser instead', () => {
      openHandler()({ url: 'https://ledger-cli.org' });
      expect(shell.openExternal).toHaveBeenCalledWith('https://ledger-cli.org');
    });

    it('never shells out non-web schemes (no file://, no custom protocols)', () => {
      openHandler()({ url: 'file:///etc/passwd' });
      openHandler()({ url: 'javascript:alert(1)' });
      expect(shell.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('in-frame navigation (will-navigate)', () => {
    it('blocks navigation to a remote origin and opens it externally', () => {
      const event = { preventDefault: jest.fn() };
      contents.emit('will-navigate', event, 'https://evil.example/phish');
      expect(event.preventDefault).toHaveBeenCalled();
      expect(shell.openExternal).toHaveBeenCalledWith('https://evil.example/phish');
    });

    it('blocks navigation to a non-web scheme without shelling out', () => {
      const event = { preventDefault: jest.fn() };
      contents.emit('will-navigate', event, 'about:blank');
      expect(event.preventDefault).toHaveBeenCalled();
      expect(shell.openExternal).not.toHaveBeenCalled();
    });
  });
});
