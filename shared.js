/**
 * Shared utility: HTML-escape a string.
 * Replaces the old global escapeHtml() that relied on echarts
 * being available in the same scope.
 */

const echarts = require('echarts');

function escapeHtml(unsafe) {
  return echarts.format.encodeHTML(unsafe);
}

module.exports = { escapeHtml };
