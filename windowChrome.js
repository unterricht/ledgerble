// Platform-adaptive BrowserWindow chrome options. Pure function so it is unit-testable.
function windowOptionsFor(platform) {
  if (platform === 'darwin') {
    // Native traffic lights stay; our unified toolbar sits beside them. Native menu bar kept.
    return { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 16 } };
  }
  if (platform === 'win32') {
    // Frameless: we draw our own window controls + in-window menu bar.
    return { frame: false };
  }
  return {}; // Linux: native frame
}
module.exports = { windowOptionsFor };
