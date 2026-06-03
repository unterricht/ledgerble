class ValuationService {
    constructor() {
        this.prices = {};
    }

    detectBaseCurrency(postings) {
        if (!postings || postings.length === 0) return 'EUR';
        const counts = {};
        let maxCount = 0;
        let baseCurrency = 'EUR';

        for (const p of postings) {
            const commodity = p.commodity || p.currency;
            if (commodity) {
                counts[commodity] = (counts[commodity] || 0) + 1;
                if (counts[commodity] > maxCount) {
                    maxCount = counts[commodity];
                    baseCurrency = commodity;
                }
            }
        }
        return baseCurrency;
    }

    detectBaseCurrencies(postings, prices) {
        const baseCurrencies = new Set();
        
        // 1. Currencies used as price targets (priceCommodity)
        if (prices) {
            for (const priceObj of Object.values(prices)) {
                if (Array.isArray(priceObj)) { // If we receive raw prices
                    for (const p of priceObj) {
                        if (p.priceCommodity) baseCurrencies.add(p.priceCommodity);
                    }
                } else if (priceObj.priceCommodity) {
                    baseCurrencies.add(priceObj.priceCommodity);
                }
            }
            
            // If prices is this.prices format
            for (const commodityPrices of Object.values(prices)) {
                if (typeof commodityPrices === 'object' && !Array.isArray(commodityPrices)) {
                    for (const d of Object.values(commodityPrices)) {
                        if (d.currency) baseCurrencies.add(d.currency);
                    }
                }
            }
        }

        // 2. Currencies used in Income/Expenses accounts
        if (postings) {
            for (const p of postings) {
                if (p.type === 'income' || p.type === 'expenses') {
                    const commodity = p.commodity || p.currency;
                    if (commodity) baseCurrencies.add(commodity);
                }
            }
        }

        // 3. Fallback: most frequent currency
        if (baseCurrencies.size === 0) {
            baseCurrencies.add(this.detectBaseCurrency(postings));
        }

        return baseCurrencies;
    }

    parsePrices(rawPrices) {
        this.prices = {};
        for (const rp of rawPrices) {
            if (!this.prices[rp.commodity]) {
                this.prices[rp.commodity] = {};
            }
            this.prices[rp.commodity][rp.date] = {
                price: parseFloat(rp.price),
                currency: rp.priceCommodity
            };
        }
    }

    _addDays(dateStr, days) {
        if (!dateStr || typeof dateStr !== 'string') return null;
        const date = new Date(dateStr + 'T00:00:00Z');
        if (isNaN(date.getTime())) return null;
        date.setUTCDate(date.getUTCDate() + days);
        return date.toISOString().split('T')[0];
    }

    getHistoricalPrice(commodity, dateStr, fallbackInfo = null) {
        if (!this.prices[commodity]) {
            if (fallbackInfo && fallbackInfo.quantity > 0) {
                return {
                    price: fallbackInfo.costBasis / fallbackInfo.quantity,
                    currency: fallbackInfo.costCurrency
                };
            }
            return null;
        }

        let checkDate = dateStr;
        for (let i = 0; i < 3650; i++) {
            if (checkDate && this.prices[commodity][checkDate]) {
                return this.prices[commodity][checkDate];
            }
            checkDate = this._addDays(checkDate, -1);
            if (checkDate === null) break;
        }

        if (fallbackInfo && fallbackInfo.quantity > 0) {
            return {
                price: fallbackInfo.costBasis / fallbackInfo.quantity,
                currency: fallbackInfo.costCurrency
            };
        }

        return null;
    }

    convertCurrency(amount, fromCurrency, toCurrency, dateStr) {
        if (fromCurrency === toCurrency) return amount;

        const directPrice = this.getHistoricalPrice(fromCurrency, dateStr);
        if (directPrice && directPrice.currency === toCurrency) {
            return amount * directPrice.price;
        }

        const inversePrice = this.getHistoricalPrice(toCurrency, dateStr);
        if (inversePrice && inversePrice.currency === fromCurrency) {
            return amount / inversePrice.price;
        }

        return null;
    }

    calculateRunningBalances(postings, postingsCost, defaultBaseCurrency = null) {
        const baseCurrency = defaultBaseCurrency || this.detectBaseCurrency(postings);
        const balances = {};
        const running = {};

        const costMap = {};
        if (postingsCost && postings.length !== postingsCost.length) {
            console.warn(`Ledger output mismatch: csv (${postings.length}) and csv -B (${postingsCost.length}) line counts differ! Using map-based matching for cost basis.`);
            for (const pc of postingsCost) {
                const key = `${pc.date}|${pc.account}`;
                if (!costMap[key]) costMap[key] = [];
                costMap[key].push(pc);
            }
        }

        for (let i = 0; i < postings.length; i++) {
            const p = postings[i];

            const account = p.account || (p.accounts ? p.accounts.join(':') : 'Unknown');
            let dateStr = p.dateString || p.date;
            if (dateStr instanceof Date) {
                dateStr = dateStr.toISOString().split('T')[0];
            }

            let pc = null;
            if (postingsCost && postings.length === postingsCost.length) {
                pc = postingsCost[i];
            } else if (postingsCost) {
                const key = `${dateStr}|${account}`;
                if (costMap[key] && costMap[key].length > 0) {
                    pc = costMap[key].shift();
                }
            }
            if (!pc) {
                pc = {
                    quantity: p.quantity !== undefined ? p.quantity : (p.amount !== undefined ? p.amount : 0), 
                    commodity: p.commodity !== undefined ? p.commodity : (p.currency !== undefined ? p.currency : '??') 
                };
            }

            const commodity = p.commodity || p.currency || '??';
            const quantity = p.quantity !== undefined ? p.quantity : (p.amount || 0);

            if (!balances[account]) balances[account] = {};
            if (!balances[account][commodity]) balances[account][commodity] = {};

            if (!running[account]) running[account] = {};
            if (!running[account][commodity]) {
                running[account][commodity] = { quantity: 0, costBasis: 0, costCurrency: pc.commodity || baseCurrency };
            }

            const r = running[account][commodity];

            if (quantity < 0) {
                if (r.quantity > 0) {
                    const avgCost = r.costBasis / r.quantity;
                    r.costBasis += (quantity * avgCost);
                }
            } else {
                r.costBasis += parseFloat(pc && pc.quantity !== undefined ? pc.quantity : (quantity || 0));
            }
            r.quantity += parseFloat(quantity || 0);

            const fallbackInfo = { quantity: r.quantity, costBasis: r.costBasis, costCurrency: r.costCurrency };
            
            let marketValue = r.costBasis;
            let convertedCostBasis = r.costBasis;

            const priceInfo = this.getHistoricalPrice(commodity, dateStr, fallbackInfo);
            
            if (priceInfo) {
                let unitPriceInBase = this.convertCurrency(priceInfo.price, priceInfo.currency, baseCurrency, dateStr);
                if (unitPriceInBase !== null) {
                    marketValue = r.quantity * unitPriceInBase;
                }
            }

            let costInBase = this.convertCurrency(r.costBasis, r.costCurrency, baseCurrency, dateStr);
            if (costInBase !== null) {
                convertedCostBasis = costInBase;
            }

            balances[account][commodity][dateStr] = {
                quantity: r.quantity,
                costBasis: convertedCostBasis,
                marketValue: marketValue,
                unrealizedGain: marketValue - convertedCostBasis
            };
        }

        return { balances, baseCurrency };
    }

    getAccountValueAtDate(balances, baseCurrency, account, commodity, dateStr) {
        if (!dateStr) return { quantity: 0, marketValue: 0, costBasis: 0 };
        if (dateStr instanceof Date) {
            dateStr = dateStr.toISOString().split('T')[0];
        }
        let lastDate = null;
        if (!balances[account] || !balances[account][commodity]) return { quantity: 0, marketValue: 0, costBasis: 0 };
        
        for (const d of Object.keys(balances[account][commodity]).sort()) {
            if (d <= dateStr) {
                lastDate = d;
            } else {
                break;
            }
        }

        if (!lastDate) return { quantity: 0, marketValue: 0, costBasis: 0 };
        
        const state = balances[account][commodity][lastDate];
        let marketValue = state.costBasis;
        let convertedCostBasis = state.costBasis;

        const priceInfo = this.getHistoricalPrice(commodity, dateStr, state);
        
        if (priceInfo) {
            let unitPriceInBase = this.convertCurrency(priceInfo.price, priceInfo.currency, baseCurrency, dateStr);
            if (unitPriceInBase !== null) {
                marketValue = state.quantity * unitPriceInBase;
            }
        }

        let costInBase = this.convertCurrency(state.costBasis, state.costCurrency, baseCurrency, dateStr);
        if (costInBase !== null) {
            convertedCostBasis = costInBase;
        }

        return { quantity: state.quantity, marketValue, costBasis: convertedCostBasis };
    }
}

module.exports = { ValuationService };
