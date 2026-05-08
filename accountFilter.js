function buildAccountTree(accounts) {
    const tree = {};
    for (const account of accounts) {
        const parts = account.split(':');
        let current = tree;
        for (const part of parts) {
            if (!current[part]) {
                current[part] = {};
            }
            current = current[part];
        }
    }
    return tree;
}

function isDeselected(account, deselected) {
    if (!deselected) return false;
    return deselected.has(account);
}

function filterPostings(postings, deselected) {
    if (!deselected || deselected.size === 0) {
        return postings;
    }
    return postings.filter(p => {
        const account = p.accountsFmtd();
        return !isDeselected(account, deselected);
    });
}

function renderFilter(containerId, tree, deselected, expandedNodes, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const $container = window.$(container);
    $container.empty();
    
    const styleHtml = `
        <style>
            .af-summary {
                cursor: pointer;
                display: flex;
                align-items: center;
                user-select: none;
                list-style: none;
            }
            .af-summary::-webkit-details-marker {
                display: none;
            }
            .af-summary::before {
                content: '▶';
                font-size: 0.7em;
                margin-right: 5px;
                color: #555;
                display: inline-block;
                width: 12px;
                text-align: center;
            }
            details[open] > .af-summary::before {
                content: '▼';
            }
            .af-leaf {
                margin-bottom: 0;
                font-weight: normal;
                cursor: pointer;
                display: flex;
                align-items: center;
                user-select: none;
                padding-left: 17px;
            }
        </style>
    `;
    
    const btnHtml = `
        <div style="margin-bottom: 10px;">
            <button id="btn-select-all" class="btn btn-sm btn-outline-secondary">Select All</button>
            <button id="btn-deselect-all" class="btn btn-sm btn-outline-secondary">Deselect All</button>
        </div>
    `;
    
    function buildHtml(node, path) {
        const keys = Object.keys(node).sort();
        if (keys.length === 0) return '';
        
        let html = '<ul style="list-style-type: none; padding-left: 15px; margin: 0;">';
        for (const key of keys) {
            const currentPath = path ? `${path}:${key}` : key;
            const isChecked = !deselected.has(currentPath);
            const checkedAttr = isChecked ? 'checked' : '';
            const hasChildren = Object.keys(node[key]).length > 0;
            
            html += `<li>`;
            if (hasChildren) {
                const isOpen = expandedNodes.has(currentPath) ? 'open' : '';
                html += `<details data-path="${currentPath}" ${isOpen}>`;
                html += `<summary class="af-summary">
                            <input type="checkbox" data-path="${currentPath}" ${checkedAttr} style="margin-right: 5px;">
                            ${key}
                         </summary>`;
                html += buildHtml(node[key], currentPath);
                html += `</details>`;
            } else {
                html += `<label class="af-leaf">
                            <input type="checkbox" data-path="${currentPath}" ${checkedAttr} style="margin-right: 5px;">
                            ${key}
                         </label>`;
            }
            html += `</li>`;
        }
        html += '</ul>';
        return html;
    }

    $container.html(styleHtml + btnHtml + buildHtml(tree, ''));
    
    $container.find('summary input[type="checkbox"]').on('click', function(e) {
        e.stopPropagation();
    });

    $container.find('details').on('toggle', function(e) {
        const path = window.$(this).data('path');
        if (this.open) {
            expandedNodes.add(path);
        } else {
            expandedNodes.delete(path);
        }
    });

    function updateIndeterminate() {
        const $checkboxes = $container.find('input[type="checkbox"]').toArray().reverse();
        window.$($checkboxes).each(function() {
            const $this = window.$(this);
            const $li = $this.closest('li');
            const $childrenCheckboxes = $li.find('ul input[type="checkbox"]');
            
            if ($childrenCheckboxes.length > 0) {
                const totalChildren = $childrenCheckboxes.length;
                const checkedChildren = $childrenCheckboxes.filter(':checked').length;
                const indeterminateChildren = $childrenCheckboxes.filter(function() { return this.indeterminate; }).length;
                
                if (checkedChildren === 0 && indeterminateChildren === 0) {
                    $this.prop('checked', false);
                    $this.prop('indeterminate', false);
                } else if (checkedChildren === totalChildren) {
                    $this.prop('checked', true);
                    $this.prop('indeterminate', false);
                } else {
                    $this.prop('checked', false);
                    $this.prop('indeterminate', true);
                }
            } else {
                $this.prop('indeterminate', false);
            }
        });
    }

    updateIndeterminate();

    $container.find('input[type="checkbox"]').on('change', function(e) {
        const checked = window.$(this).is(':checked');
        
        window.$(this).closest('li').find('input[type="checkbox"]').prop('checked', checked);
        
        updateIndeterminate();
        
        deselected.clear();
        $container.find('input[type="checkbox"]').each(function() {
            if (!window.$(this).is(':checked') && !window.$(this).prop('indeterminate')) {
                deselected.add(window.$(this).data('path'));
            }
        });
        
        onChange();
    });

    $container.find('#btn-select-all').on('click', function(e) {
        $container.find('input[type="checkbox"]').prop('checked', true).prop('indeterminate', false);
        deselected.clear();
        onChange();
    });

    $container.find('#btn-deselect-all').on('click', function(e) {
        $container.find('input[type="checkbox"]').prop('checked', false).prop('indeterminate', false);
        $container.find('input[type="checkbox"]').each(function() {
            deselected.add(window.$(this).data('path'));
        });
        onChange();
    });
}

module.exports = {
    buildAccountTree,
    isDeselected,
    filterPostings,
    renderFilter
};
