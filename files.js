/**
 * Maintains the file selection
 *
 * Modernised: uses window.api (preload bridge) instead of
 * require('electron').ipcRenderer and require('settings-store').
 * Globals window.state, window.update, window.escapeHtml are
 * set by ui.js before any of these functions are called.
 */

const { getSetting } = require('./options')
const { t } = require('./i18n')

const input = document.getElementById("fileSelector")

let fileNumber = 1;

function filesInit() {
    input.addEventListener('change', () => {
        const fileObj = input.files[0];
        if (!fileObj) return;
        const filePath = window.api.webUtils.getPathForFile(fileObj) || fileObj.path;
        if (filePath) {
            addFile(filePath)
            saveFilesList()
        }
    });

    //https://stackoverflow.com/questions/1163667/how-to-rename-html-browse-button-of-an-input-type-file
    $('#addFileButton').click(function (e) {
        e.preventDefault(); // prevents submitting
        $('#fileSelector').trigger('click');
    });

    $('#reloadFileButton').click(function (e) {
        reloadFiles();
    });

    // Load stored file list directly from main process
    window.api.settings.get('files.list', []).then(filesList => {
        if (!Array.isArray(filesList)) filesList = [];
        for (const f of filesList) {
            addFile(f)
        }

        if (getCurrentPaths().length == 0) {
            $(`<div class="alert  alert-dismissible fade show alert-warning" role="alert">
            ${t('files.no_files_alert')}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>`).prependTo('body')
        }
    });
}

function reloadFiles() {
    for (path of getCurrentPaths()) {
        window.api.parse(getSetting("options.ledger.command"), getSetting('options.hledger'), path)
    }
}



function saveFilesList() {
    window.api.settings.set("files.list", getCurrentPaths())
}

function getCurrentPaths() {
    paths = [];
    for (d of document.querySelectorAll('[id^="fileRow"]')) {
        paths.push(d.path);
    }
    return paths
}


function alertCantparse(file, error) {
    for (d of document.querySelectorAll('[id^="fileRow"]')) {

        if (d.path === file) {
            document.getElementById('enable' + d.id).checked = false
        }
    }
    $(`<div class="alert  alert-dismissible fade show alert-danger" role="alert">
    ${t('files.cant_parse')} ${window.escapeHtml(file)} <br>${window.escapeHtml(error)}
    <button type="button" class="close" data-dismiss="alert" aria-label="Close">
      <span aria-hidden="true">&times;</span>
    </button>
  </div>`).prependTo('body')

}

function addFile(path) {
    if (getCurrentPaths().indexOf(path) !== -1) {
        return;
    }
    const id = `fileRow${fileNumber++}`
    const newItem = document.createElement('a')

    // Get basename asynchronously, update UI when ready
    const displayName = path ? (path.split('/').pop() || path.split('\\').pop() || path) : t('files.unknown');

    newItem.innerHTML =
        `<div style='display:flex;  justify-content:space-between; align-items:center; '>
        <label><input id='enable${id}' type="checkbox" value="" checked )>
        ${window.escapeHtml(displayName)}&nbsp;&nbsp;&nbsp;&nbsp; </label>
        <button class="btn btn-warning" id="remove${id}">${t('btn.close')}</button> 
        </div>`
    newItem.classList.add('dropdown-item');
    newItem.href = '#'
    newItem.id = id
    newItem.path = path

    document.getElementById('filesListDropDown').insertBefore(
        newItem,
        document.getElementById('filesDropDownDivider'))

    document.getElementById('enable' + id).addEventListener("click", function () {
        enableFileById(id)
    });
    document.getElementById('remove' + id).addEventListener("click", function () {
        removeFileById(id)
    });

    window.api.parse(getSetting("options.ledger.command"), getSetting('options.hledger'), path)


}

function removeFileById(id) {
    const element = document.getElementById(id)
    const path = element.path
    element.remove();
    saveFilesList()
    window.state.files.delete(path)
    window.update()

}

function enableFileById(id) {
    const element = document.getElementById(id)
    const path = element.path
    enabled = document.getElementById('enable' + id).checked
    if (enabled) {
        window.api.parse(getSetting("options.ledger.command"), getSetting('options.hledger'), path)
    } else {
        window.state.files.delete(path)
        window.update()
    }

}



module.exports = { filesInit, alertCantparse, reloadFiles }