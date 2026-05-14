const { t } = require('./i18n');

function setupPrintHeader(state) {
    window.addEventListener('beforeprint', () => {
        const header = document.getElementById('printHeader');
        if (!header) return;

        const filesString = Array.from(state.files.keys()).map(f => {
            return f.split('/').pop().split('\\').pop();
        }).join(', ');
        
        const date = new Date().toLocaleDateString();
        
        const dateRangeFrom = document.getElementById('dateRangeFrom') ? document.getElementById('dateRangeFrom').value : '';
        const dateRangeTo = document.getElementById('dateRangeTo') ? document.getElementById('dateRangeTo').value : '';
        const dateUnit = document.getElementById('dateUnitsSelector') ? document.getElementById('dateUnitsSelector').value : '';
        
        let deselected = '';
        if (state.deselectedAccounts && state.deselectedAccounts.size > 0) {
            const arr = Array.from(state.deselectedAccounts).sort();
            const summaryArr = [];
            for (const acc of arr) {
                if (!summaryArr.some(parent => acc.startsWith(parent + ':'))) {
                    summaryArr.push(acc);
                }
            }
            deselected = summaryArr.join(', ');
        }
        const accountStr = deselected.length > 0 ? deselected : t('print.all_categories');

        const headerHtml = `
            <h3>${escapeHtml(filesString)} - ${escapeHtml(date)}</h3>
            <p>
                <strong>${t('print.period')}</strong> ${escapeHtml(dateRangeFrom)} to ${escapeHtml(dateRangeTo)} (${escapeHtml(dateUnit)})<br>
                <strong>${deselected.length > 0 ? t('print.excluded_categories') : t('print.categories')}</strong> ${escapeHtml(accountStr)}
            </p>
        `;
        header.innerHTML = headerHtml;
    });
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

module.exports = { setupPrintHeader };
