// windowSecurity.js
// Pure logic: defense-in-depth navigation hardening for a renderer that only
// ever loads the bundled local index.html. electron's `shell` is injected so
// the module unit-tests without a running Electron.
//
// Two guards:
//   1. setWindowOpenHandler → deny *every* new window/window.open. Genuine
//      http(s) links are handed to the user's real browser instead.
//   2. will-navigate → the SPA never navigates its own frame, so block any
//      attempt to and likewise route http(s) out to the browser.

function isWebUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function hardenWindowSecurity(contents, shell) {
  contents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    event.preventDefault();
    if (isWebUrl(url)) shell.openExternal(url);
  });
}

module.exports = { hardenWindowSecurity, isWebUrl };
