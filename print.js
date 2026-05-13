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
        
        const deselected = state.deselectedAccounts ? Array.from(state.deselectedAccounts).join(', ') : '';
        const accountStr = deselected.length > 0 ? `Deselected: ${deselected}` : `All categories active`;

        const headerHtml = `
            <h3>${escapeHtml(filesString)} - ${escapeHtml(date)}</h3>
            <p>
                <strong>Period:</strong> ${escapeHtml(dateRangeFrom)} to ${escapeHtml(dateRangeTo)} (${escapeHtml(dateUnit)})<br>
                <strong>Categories:</strong> ${escapeHtml(accountStr)}
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
