const fs = require('fs');
let content = fs.readFileSync('valuation.js', 'utf8');

// Insert logging at the point of map-based matching warning
content = content.replace(
    'console.warn(`Ledger output mismatch: csv (${postings.length}) and csv -B (${postingsCost.length}) line counts differ! Using map-based matching for cost basis.`);',
    `console.warn(\`Ledger output mismatch: csv (\${postings.length}) and csv -B (\${postingsCost.length}) line counts differ! Using map-based matching for cost basis.\`);
            console.warn("DEBUG_LOG: First 5 postings: ", JSON.stringify(postings.slice(0, 5)));
            console.warn("DEBUG_LOG: First 5 postingsCost: ", JSON.stringify(postingsCost.slice(0, 5)));`
);

// Insert logging where pc is shifted
content = content.replace(
    'pc = costMap[key].shift();',
    `pc = costMap[key].shift();
                    if (costMap[key].length > 0) {
                        // console.warn(\`DEBUG_LOG: costMap[\${key}] still has \${costMap[key].length} items left after shift!\`);
                    }`
);

// Insert logging where costCurrency and unrealizedGain might cancel out
const target = `const r = running[account][commodity];`;
content = content.replace(target, 
    `const r = running[account][commodity];
            if (pc && pc.commodity === commodity && pc.commodity !== baseCurrency) {
                // console.warn(\`DEBUG_LOG: ALARM! pc.commodity equals asset commodity (\${commodity}) on date \${dateStr}. This might cause 0 unrealized gains!\`, p, pc);
            }`
);

fs.writeFileSync('valuation.js', content);
