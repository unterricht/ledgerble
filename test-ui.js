const ui_code = require('fs').readFileSync('ui.js', 'utf8');
const match = ui_code.includes('let intervalDateStr = state.intervals[i];');
console.log("Match: ", match);
