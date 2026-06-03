const papaparse = require('papaparse');
const res = papaparse.parse('"2024/01/01","","Buy","Assets:Depot","\\"VWRD.L\\"","1","",""', {
    delimiter: ',',
    header: false,
    escapeChar: '\\',
});
console.log(res.data[0][4]);
