const echarts = require('echarts');
const numeral = require('numeral');
const { t } = require('./i18n');

function updatePortfolio(chartElement, tableBodyElement, state, valResult, valuationService, currentCurrency, intervals, intervalDates, sliderValues) {
    if (!valResult || !valResult.balances) return null;
    if (!intervals || intervals.length === 0) return null;

    let displayIntervals = intervals;
    let displayIntervalDates = intervalDates;
    if (sliderValues && sliderValues.length === 2) {
        displayIntervals = intervals.slice(sliderValues[0], sliderValues[1] + 1);
        if (intervalDates) {
            displayIntervalDates = intervalDates.slice(sliderValues[0], sliderValues[1] + 1);
        }
    }

    // Check if we have any non-base currency assets
    let hasPortfolioAssets = false;
    for (const acc in valResult.balances) {
        for (const comm in valResult.balances[acc]) {
            if (comm !== currentCurrency) {
                hasPortfolioAssets = true;
                break;
            }
        }
        if (hasPortfolioAssets) break;
    }

    if (!hasPortfolioAssets) {
        $('#portfolio-tab').hide();
        return null;
    } else {
        $('#portfolio-tab').show();
    }

    const seriesDataCost = [];
    const seriesDataGain = [];
    let tableRowsHtml = '';
    
    // We aggregate data for the chart across all accounts/commodities
    const aggregatedCost = new Array(displayIntervals.length).fill(0);
    const aggregatedGain = new Array(displayIntervals.length).fill(0);

    for (const account of Object.keys(valResult.balances)) {
        for (const commodity of Object.keys(valResult.balances[account])) {
            if (commodity === currentCurrency) continue;

            const latestDate = displayIntervalDates ? displayIntervalDates[displayIntervalDates.length - 1] : displayIntervals[displayIntervals.length - 1];
            const currentVal = valuationService.getAccountValueAtDate(valResult.balances, currentCurrency, account, commodity, latestDate);
            
            if (currentVal.quantity !== 0) {
                const unrealized = currentVal.marketValue - currentVal.costBasis;
                tableRowsHtml += `
                    <tr>
                        <td>${account}</td>
                        <td>${commodity}</td>
                        <td>${numeral(currentVal.quantity).format('0,0.00')}</td>
                        <td>${state.formatter(currentVal.costBasis)}</td>
                        <td>${state.formatter(currentVal.marketValue)}</td>
                        <td style="color: ${unrealized >= 0 ? 'green' : 'red'};">${state.formatter(unrealized)}</td>
                    </tr>
                `;
            }

            for (let i = 0; i < displayIntervals.length; i++) {
                const lookupDate = displayIntervalDates ? displayIntervalDates[i] : displayIntervals[i];
                const val = valuationService.getAccountValueAtDate(valResult.balances, currentCurrency, account, commodity, lookupDate);
                aggregatedCost[i] += val.costBasis;
                aggregatedGain[i] += (val.marketValue - val.costBasis);
            }
        }
    }

    $(tableBodyElement).html(tableRowsHtml);

    if (chartElement.clientWidth === 0 || chartElement.clientHeight === 0) {
        return null; // Tab is hidden, skip chart rendering until shown
    }
    const chart = echarts.getInstanceByDom(chartElement) || echarts.init(chartElement, 'macarons');

    const costBasisLabel = t('portfolio.cost_basis');
    const unrealizedGainsLabel = t('portfolio.unrealized_gains');

    const option = {
        tooltip: {
            className: 'echarts-tooltip',
            trigger: 'axis',
            axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } },
            valueFormatter: (value) => state.formatter(value)
        },
        legend: { data: [costBasisLabel, unrealizedGainsLabel] },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: [
            {
                type: 'category',
                boundaryGap: false,
                data: displayIntervals
            }
        ],
        yAxis: [{ type: 'value' }],
        series: [
            {
                name: costBasisLabel,
                type: 'line',
                stack: 'Total',
                areaStyle: {},
                emphasis: { focus: 'series' },
                data: aggregatedCost
            },
            {
                name: unrealizedGainsLabel,
                type: 'line',
                stack: 'Total',
                areaStyle: {},
                emphasis: { focus: 'series' },
                data: aggregatedGain
            }
        ]
    };

    chart.setOption(option);
    return chart;
}

module.exports = { updatePortfolio };
