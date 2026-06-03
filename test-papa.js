const papaparse = require('papaparse');
const out = '"2024/01/01","","Buy","Assets:Depot","\\"VWRD.L\\"","1","",""';
const resCsv = papaparse.parse(out, {
    delimiter: ',',
    header: false,
    escapeChar: '\\',
});
console.log(JSON.stringify(resCsv.data[0]));
