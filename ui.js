/**
 * UI code
 *
 * Modernised: uses window.api (preload bridge) instead of
 * require('electron').ipcRenderer and require('settings-store').
 */

const Stream = require('streamjs');
const { ValuationService } = require('./valuation');

const updateIncomeExpenses = require('./incomeExpenses')
const { buildAccountTree, filterPostings, renderFilter } = require('./accountFilter');
const echarts = require('echarts');
//https://stackoverflow.com/questions/51369979/bootstrap-uncaught-typeerror-cannot-read-property-fn-of-undefined 
//https://github.com/understrap/understrap/issues/449 
window.$ = window.jQuery = require('jquery');
window.Bootstrap = require('bootstrap');
require('./vendor/jquery-ui/1.12.1/jquery-ui')
require("./vendor/echarts/macaron.js")
const { dateInit, dateUpdate, setDate } = require('./dateRangeSelector')
const { filesInit, alertCantparse, reloadFiles } = require('./files')
const updateAssets = require('./assets')
const updateBalance = require('./balance')
const { updatePortfolio } = require('./portfolio')
var bs = require("binary-search");
const numeral = require('numeral')

const { updatePostings } = require('./postings')
const { updateCurrencies, initCurrencies } = require('./currency')

const CurrencyFormatter = require('currencyformatter.js')
const currencyToSymbolMap = require('currency-symbol-map/map')
const { initSettings, getSetting, loadSettingsCache } = require('./options')
const setupToggle = require('./toggle')
const updateTreeMap = require('./treeMap')
//showModal isn't used explicitly, but its called from
//an href so it must be included here
const { showModal } = require('./treeTable')
// Make showModal available globally for href="javascript:showModal(...)"
window.showModal = showModal;

const { updateFilterVisibility } = require('./tabVisibility');

const { escapeHtml } = require('./shared')
// Make escapeHtml globally available for modules that reference it
window.escapeHtml = escapeHtml;

const { t, loadLocale, detectLocale, translatePage } = require('./i18n')
// Expose translatePage globally so the options onChange callback can call it
window.i18nTranslatePage = translatePage;

require('datatables.net-dt');
require('datatables.net-buttons-dt')(window, window.$);
require('datatables.net-buttons/js/buttons.colVis.js')(window, window.$);
require('datatables.net-colreorder-dt');
require('datatables.net-fixedheader-dt');
require('datatables.net-responsive-dt');
require('datatables.net-scroller-dt');

//state of a single file
//either parsed and a list of Postings,
//or an error
class FileState {
    constructor(error, data) {
        this.error = error;
        if (data && data.postings) {
            this.postings = data.postings;
            this.postingsCost = data.postingsCost || [];
            this.prices = data.prices || [];
        } else {
            this.postings = data || [];
            this.postingsCost = [];
            this.prices = [];
        }
    }
}


//state of the app
class State {
    constructor() {
        this.files = new Map() //maps string->FileState
        this.deselectedAccounts = new Set();
        this.expandedNodes = new Set();
    }
}

$('#cantParseAlert').hide()

const state = new State();
// Expose state globally for modules that need it (files.js, treeTable.js)
window.state = state;

setupToggle(
    document.getElementById('expensesDisplayGraph'),
    document.getElementById('expensesDisplayTree'),
    document.getElementById('expensesTreeMap'),
    document.getElementById('expensesTable')
)
setupToggle(
    document.getElementById('incomeDisplayGraph'),
    document.getElementById('incomeDisplayTree'),
    document.getElementById('incomeTreeMap'),
    document.getElementById('incomeTable')
)


function accountsFmtd() {
    return this.accounts.join(':')
}

function dateFmtd() {
    return this.date.getFullYear() + '/' + (1 + this.date.getMonth()) + '/' + this.date.getDate()
}

let typeExtractor = null;

function updateTypeExtractor() {
    typeExtractor = accountString => {
        const expensesRegex = getSetting('options.expenses.regex');
        if(accountString.match(new RegExp(expensesRegex, "i"))) {
          return 'expenses'
        }
        const incomeRegex = getSetting('options.income.regex');
        if(accountString.match(new RegExp(incomeRegex, "i"))) {
          return 'income'
        }
        const assetsRegex = getSetting('options.assets.regex');
        if(accountString.match(new RegExp(assetsRegex, "i"))) {
          return 'assets'
        }
        const liabilitiesRegex = getSetting('options.liabilities.regex');
        if(accountString.match(new RegExp(liabilitiesRegex, "i"))) {
          return 'liabilities'
        }
        const equityRegex = getSetting('options.equity.regex');
        if(accountString.match(new RegExp(equityRegex, "i"))) {
          return 'equity'
        }
        return 'unknown'
    }
}

// ── Async initialisation ────────────────────────────────────
// Settings now live in the main process. We load them once at
// startup and cache them in the renderer for synchronous access.

async function initApp() {
    // Load all settings from main process into the local cache
    // used by options.js / getSetting()
    await loadSettingsCache();

    // ── i18n: detect and apply locale ────────────────────────
    const savedLocale = getSetting('options.locale');
    const effectiveLocale = (!savedLocale || savedLocale === 'auto')
        ? detectLocale(navigator.language || 'en')
        : savedLocale;
    loadLocale(effectiveLocale);
    translatePage();
    // Update <html lang> attribute for accessibility
    document.getElementById('html-root').lang = effectiveLocale;

    dateInit(state);
    updateTypeExtractor();

    initSettings(() => {
        updateTypeExtractor()
        reloadFiles()
    })
    updateTypeExtractor()
}

const { setupPrintHeader } = require('./print');
setupPrintHeader(state);

initApp();

// ── IPC: receive parsed results via preload bridge ──────────
window.api.onParsed(function (file, result, error) {
    if (error) {
        alertCantparse(file, error)
    }
    else if (result) {
        let postingsToMap = result.postings || result;
        postingsToMap.forEach(t => {
            t.dateString = t.date; // Keep original YYYY-MM-DD
            t.date = new Date(t.date + 'T00:00:00Z');
            t.accountsFmtd = accountsFmtd
            t.dateFmtd = dateFmtd;
            t.type = typeExtractor(t.accounts.join(':'))
        })
    }

    state.files.set(file, new FileState(error, result))
    update();
});

charts = [];
const chartOpts = { height: 400 };
const expensesTreeMap = echarts.init(document.getElementById('expensesTreeMap'), 'macarons', chartOpts)
charts.push(expensesTreeMap)
const incomeTreeMap = echarts.init(document.getElementById('incomeTreeMap'), 'macarons', chartOpts)
charts.push(incomeTreeMap)
const incomeExpenses = echarts.init(document.getElementById('incomeExpenses'), 'macarons', chartOpts)
charts.push(incomeExpenses)
const assetsChart = echarts.init(document.getElementById('assetsChart'), 'macarons', chartOpts)
charts.push(assetsChart)

//https://stackoverflow.com/questions/30468111/bootstrap-shown-bs-tab-event-not-working
//update the graphs when tab changes
$('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
    const target = $(e.target).attr("href");
    updateFilterVisibility(target, $('#accountFilterContainer'));
    update();
    // Resize all charts (including portfolio) when switching tabs
    for (const chart of charts) {
        chart.resize();
    }
})

$('document').ready(() => filesInit());


initCurrencies(update)

// Expose update globally for modules that need it (files.js, dateRangeSelector.js)
window.update = update;

function update() {

    let allPostings = [];
    let allPostingsCost = [];
    let allPrices = [];

    for (let f of state.files.values()) {
        if (f && !f.error) {
            allPostings = allPostings.concat(f.postings || []);
            allPostingsCost = allPostingsCost.concat(f.postingsCost || []);
            allPrices = allPrices.concat(f.prices || []);
        }
    }

    const valuationService = new ValuationService();
    valuationService.parsePrices(allPrices);
    let valResult;
    try {
        valResult = valuationService.calculateRunningBalances(allPostings, allPostingsCost);
    } catch(e) {
        console.error(e);
        valResult = { balances: {}, baseCurrency: 'EUR' };
    }

    state.postingsBeforeCurrencySelected = Stream(state.files.values())
        .filter(t => t) //Stream gives an extra undefined for some reason
        .filter(t => !t.error)
        .flatMap(t => t.postings)
        .toList()

    let currencies = valuationService.detectBaseCurrencies(state.postingsBeforeCurrencySelected, valuationService.prices);

    currentCurrency = updateCurrencies(currencies)

    // Ensure the default selection aligns with the base currency if available
    if (currencies.has(valResult.baseCurrency) && !state.hasAutoSelectedCurrency) {
        currentCurrency = valResult.baseCurrency;
        $('#currencySelect').val(currentCurrency);
        state.hasAutoSelectedCurrency = true;
    }

    createValueFormatter(currentCurrency);

    state.rawPostings = state.postingsBeforeCurrencySelected.filter(t => t.currency === currentCurrency)

    let dates = []
    for (p of state.rawPostings) {
            dates.push(p.date)
    }

    dates.sort((a, b) => {
        return a.getTime() - b.getTime()
    })

    state.intervals = []
    if (dates.length > 0) {

        let endStr = state.dateFormat(dates[dates.length - 1])
        let current = new Date(dates[0].getTime())
        let currStr = state.dateFormat(current)
        state.intervals.push(currStr)
        state.intervalDates = [new Date(current.getTime())]
        while (currStr < endStr) {
            current.setDate(current.getDate() + 1)
            let newCurrStr = state.dateFormat(current)
            if (newCurrStr !== currStr) {
                state.intervals.push(newCurrStr)
                state.intervalDates.push(new Date(current.getTime()))
                currStr = newCurrStr
            }

        }
        if (endStr !== currStr) {
            state.intervals.push(endStr)
            state.intervalDates.push(new Date(current.getTime()))
        }
    }

    state.balances = calculateBalances(filterPostings(state.rawPostings, state.deselectedAccounts),
        state.intervals,
        state.dateFormat)

    // --- MARKET VALUE SUBSTITUTION ---
    // For each account and interval, add the market value of non-base currency assets
    for (let [keyStr, amounts] of state.balances.entries()) {
        const accountMatches = Array.from(state.deselectedAccounts).some(deselected => keyStr.account && keyStr.account.startsWith(deselected));
        if (accountMatches) continue;

        let accountName = keyStr.account;
        // valResult.balances[accountName] contains all commodities
        if (valResult.balances[accountName]) {
            for (let i = 0; i < state.intervals.length; i++) {
                let intervalDateStr = state.intervals[i];
                let additionalValue = 0;
                for (const commodity of Object.keys(valResult.balances[accountName])) {
                    // Only add if it's NOT the current selected currency, because those are already in rawPostings!
                    if (commodity !== currentCurrency) {
                        const val = valuationService.getAccountValueAtDate(valResult.balances, currentCurrency, accountName, commodity, state.intervalDates[i]);
                        additionalValue += val.marketValue;
                    }
                }
                amounts[i] += additionalValue;
            }
        }
    }
    // ---------------------------------

    const sliderValues = dateUpdate(state)

    const portfolioChart = updatePortfolio(
        document.getElementById('portfolioChart'),
        document.getElementById('portfolioTableBody'),
        state,
        valResult,
        valuationService,
        currentCurrency,
        state.intervals,
        state.intervalDates,
        sliderValues
    );
    // Track portfolio chart for resize handling
    if (portfolioChart && !charts.includes(portfolioChart)) {
        charts.push(portfolioChart);
    }

    dateFilter = p => {
        formattedDate = state.dateFormat(p.date)
        return formattedDate >= state.intervals[sliderValues[0]] &&
            formattedDate <= state.intervals[sliderValues[1]]
    }
    state.postings = []
    for (p of state.rawPostings) {
        if (dateFilter(p)) {
            state.postings.push(p)
        }
    }


    const relevantAccounts = new Set();
    for (const p of state.postings) {
        if (p.type === 'income' || p.type === 'expenses') {
            relevantAccounts.add(p.accountsFmtd());
        }
    }
    const accountTree = buildAccountTree(Array.from(relevantAccounts));
    renderFilter('accountFilterContainer', accountTree, state.deselectedAccounts, state.expandedNodes, () => {
        update();
    });

    const filteredPostings = filterPostings(state.postings, state.deselectedAccounts);

    const expensesPostings = Stream(filteredPostings)
        .filter(t => t.type === 'expenses')
        .toList();
    updateTreeMap(expensesTreeMap, document.getElementById('expensesTable'), expensesPostings, false, state.formatter);

    const incomePostings = Stream(filteredPostings)
        .filter(t => t.type === 'income')
        .toList();
    updateTreeMap(incomeTreeMap, document.getElementById('incomeTable'), incomePostings, true, state.formatter);

    updateIncomeExpenses(
        incomeExpenses,
        filteredPostings,
        state.dateFormat,
        state.intervals.slice(sliderValues[0], sliderValues[1] + 1),
        state.formatter,
        date => {
            setDate(date, state)
        },
        document.getElementById('incomeExpensesTable'))
    for (chart of charts) {
        chart.resize();
    }

    updateBalance($("#balanceTable").get()[0], state.balances, sliderValues[1], state.formatter)
    updateAssets(assetsChart, state.balances, state.intervals, sliderValues[0], sliderValues[1], state.formatter)
    updatePostings(filteredPostings, state.formatter, $('#postingsTable'), true);
}

function createValueFormatter(currentCurrency) {

    //try to format the currency correclty
    //look up the currency code form the currency, that
    //translates $ to USD
    //then use the default formatter for that currency
    //test the formatter to see if it works, if it doesn't
    //fall back to something simple


    let currencyCode = currentCurrency;
    if (currencyCode === '$') {
        currencyCode = "USD"
    }

    for (let [key, value] of Object.entries(currencyToSymbolMap)) {
        if (value === currencyCode) {

            currencyCode = key;
        }
    }

    state.formatter = val => CurrencyFormatter.format(val, { currency: currencyCode });
    try {
        state.formatter(1);
    }
    catch (err) {
        //that didn't work, fall back
        state.formatter = value => numeral(value).format('0,0.00') + " " + currentCurrency;
    }
}

class BalanceKey {
    constructor(account, type) {
        this.account = account;
        this.type = type;
    }

    toString() {
        return this.account + '<****>' + this.type;
    }
}

function calculateBalances(rawPostings, intervals, dateFormat) {

    let keys = new Map()

    //map of account to an array of values for each
    //interval which represent the total for that
    //account at that time

    
    const amountsBucketed = new Map()
    for (p of rawPostings) {

        let key = new BalanceKey(p.accounts.join(':'), p.type)
        //in javascripts it
        //seems object have to be the same
        //to be equal
        //uniquify them
        if(keys.has(key.toString())) {
            key = keys.get(key.toString())
        } else {
            keys.set(key.toString(), key)
        }
        let amounts;
        if (amountsBucketed.has(key)) {
            
            amounts = amountsBucketed.get(key)
        } else {
            amounts = Array.from(intervals, _ => 0)
            amountsBucketed.set(key, amounts)
        }

        const date = dateFormat(p.date)
        let index = bs(intervals, date, (x, y) => x.localeCompare(y))
        if (index < 0) {
            index = 0;
        }
        for (i = index; i < amounts.length; i++) {
            amounts[i] = amounts[i] + p.amount;
        }
    }
    return amountsBucketed
}

$(window).on('resize', function () {
    for (chart of charts) {
        chart.resize();
    }
});
