function updateFilterVisibility(targetTabHref, $filterContainer) {
    if (targetTabHref === '#options') {
        $filterContainer.hide();
    } else {
        $filterContainer.show();
    }
}

module.exports = { updateFilterVisibility };
