/**
 * options settings
 *
 * Modernised: settings are stored in the main process via IPC.
 * A local cache is loaded at startup for synchronous reads.
 */

// ── Settings cache (loaded once from main at startup) ───────
let settingsCache = {};

const { t, loadLocale, getAvailableLocales, detectLocale } = require('./i18n');
const { RULE_LABEL } = require('./src/data/pickCats');

async function loadSettingsCache() {
    settingsCache = await window.api.settings.getAll();
    if (!settingsCache || typeof settingsCache !== 'object') {
        settingsCache = {};
    }
}


function validateRegex(val) {
    try {
        'a'.match(new RegExp(val))
        return true;
    } catch (e) {
        return false;
    }
}



class Setting {
    constructor(propName, def, help, displayName, type, validate, onChange, getOptions) {
        this.propName = propName;
        this.def = def;
        this.help = help;
        this.displayName = displayName;
        this.type = type;
        this.domId = propName.replace(/\./g, '_');
        this.validate = validate ? validate : _ => true;
        this.onChange = onChange ? onChange : () => {};
        this.getOptions = getOptions ? getOptions : () => [];
    }

}

const FILE = 'file'
const STRING = 'string'
const BOOL = 'bool'
const DROPDOWN = 'dropdown'

let realTypeExtractor = null;
let updateTypeExtractor = () => realTypeExtractor()

const allSettings = [
    new Setting(
        "options.ledger.command",
        "ledger",
        () => t('settings.ledger_command.help'),
        () => t('settings.ledger_command'),
        FILE,
        null,
        null),
    new Setting(
        "options.hledger",
        false,
        () => t('settings.hledger.help'),
        () => t('settings.hledger'),
        BOOL,
        null,
        null),
    new Setting(
        "options.expenses.regex",
        "^expenses?(:|$)",
        () => t('settings.expenses_regex.help'),
        () => t('settings.expenses_regex'),
        STRING,
        validateRegex,
        updateTypeExtractor),
    new Setting(
        "options.income.regex",
        "^(income|revenue)s?(:|$)",
        () => t('settings.income_regex.help'),
        () => t('settings.income_regex'),
        STRING,
        validateRegex,
        updateTypeExtractor),
    new Setting(
        "options.assets.regex",
        "^assets?(:|$)",
        () => t('settings.assets_regex.help'),
        () => t('settings.assets_regex'),
        STRING,
        validateRegex,
        updateTypeExtractor),
    new Setting(
        "options.liabilities.regex",
        "^(debts?|liabilit(y|ies))(:|$)",
        () => t('settings.liabilities_regex.help'),
        () => t('settings.liabilities_regex'),
        STRING,
        validateRegex,
        updateTypeExtractor),
    new Setting(
        "options.equity.regex",
        "^equity(:|$)",
        () => t('settings.equity_regex.help'),
        () => t('settings.equity_regex'),
        STRING,
        validateRegex,
        updateTypeExtractor),
    new Setting(
        "options.locale",
        "auto",
        () => t('settings.language.help'),
        () => t('settings.language'),
        DROPDOWN,
        val => val === 'auto' || getAvailableLocales().includes(val),
        () => {
            const newLocale = getSetting('options.locale');
            const effectiveLocale = newLocale === 'auto'
                ? detectLocale(navigator.language || 'en')
                : newLocale;
            loadLocale(effectiveLocale);
            if (typeof window !== 'undefined' && window.i18nTranslatePage) window.i18nTranslatePage();
            if (window.api && window.api.menu && window.api.menu.rebuild) {
                window.api.menu.rebuild();
            }
            // Re-render settings table in the newly selected language
            initSettings(realTypeExtractor);
        },
        () => ['auto', ...getAvailableLocales()]
    ),
    new Setting(
        "options.overview.catRule",
        "top5",
        () => t('settings.category_table.help'),
        () => t('settings.category_table'),
        DROPDOWN,
        val => Object.keys(RULE_LABEL).includes(val),
        () => {
            if (typeof window !== 'undefined' && window.update) window.update();
        },
        () => Object.keys(RULE_LABEL).map(val => ({ value: val, label: RULE_LABEL[val] }))
    ),
]

function initSettings(updateTypeExtractor) {
    realTypeExtractor = updateTypeExtractor
    let htmlSettings = [];
    htmlSettings.push(`
        <style>
        #settings-table table {
            border-collapse: collapse;
          }
          
          #settings-table table, th, td {
            border: 1px solid #d4d4d4;
          }

          #settings-table th, td {
            padding: 3px;
          }

          #settings-table tr {
            text-align:center
          }

          #settings-table td {
            text-align:left
          }

          
          
          
        </style>
    `)
    htmlSettings.push(`<table id='settings-table'><th>${t('settings.title.setting')}</th><th>${t('settings.title.value')}</th><th>${t('settings.title.description')}</th><th></th></tr>`);

    for (s of allSettings) {
        htmlSettings.push("<tr>")
        htmlSettings.push(`<td>${typeof s.displayName === 'function' ? s.displayName() : s.displayName}</td>`)
        if (s.type === FILE) {
            htmlSettings.push(`<td>
            <input type="text" id="${s.domId}" size="25">
            <input type="file" id="${s.domId}_file" style="display: none;" />
            <input type="button" id="${s.domId}_browse" value="${t('btn.browse')}" />
            </td>`  )
        } else if (s.type === STRING) {
            htmlSettings.push(`<td>
            <input type="text" id="${s.domId}" size="25">
            </td>`  )
        } else if (s.type === DROPDOWN) {
            let optionsHtml = s.getOptions().map(opt => {
                const val = (opt && typeof opt === 'object') ? opt.value : opt;
                const lbl = (opt && typeof opt === 'object') ? opt.label : opt;
                return `<option value="${val}">${lbl}</option>`;
            }).join('');
            htmlSettings.push(`<td>
            <select id="${s.domId}">
                ${optionsHtml}
            </select>
            </td>`  )
        }
        else if (s.type == BOOL) {
            htmlSettings.push(`
            <td><input type="checkbox" id="${s.domId}"></input></td>`)
        } else {
            throw 'fail'
        }
        htmlSettings.push(`<td>${typeof s.help === 'function' ? s.help() : s.help}</td>`);
        htmlSettings.push(`<td><input type="button" id="${s.domId}_reset" value="${t('btn.use_default')}" /></td>`)
        htmlSettings.push("</tr>")
    }


    htmlSettings.push("</table>")
    $('#settingsDiv').html(htmlSettings.join('\n'))

    for (const s of allSettings) {
        let extract = null;
        let save = () => {
            let newVal = extract()
            if (s.validate(newVal)) {
                // Update local cache and persist to main process
                settingsCache[s.propName] = newVal;
                window.api.settings.set(s.propName, newVal);
                s.onChange()
            } else {
                alert(t('settings.invalid_value'))
            }
        };
        let val = getSetting(s.propName)
        if (s.type === FILE) {
            extract = () => $(`#${s.domId}`).val()
            $(`#${s.domId}`).val(val)

            $(`#${s.domId}_browse`).click(() => {
                document.getElementById(`${s.domId}_file`).click();
            })
            $(`#${s.domId}_file`).change(() => {
                $(`#${s.domId}`).val(document.getElementById(`${s.domId}_file`).files[0].path)
                save()
            })
            $(`#${s.domId}`).change(() => {
                save()
            })
        } else if (s.type === STRING || s.type === DROPDOWN) {
            extract = () => $(`#${s.domId}`).val()
            $(`#${s.domId}`).val(val)

            $(`#${s.domId}`).change(() => {
                save()
            })
        }
        else if (s.type == BOOL) {
            extract = () => $(`#${s.domId}`).is(":checked")

            $(`#${s.domId}`).prop('checked', val)
            $(`#${s.domId}`).change(() => {
                save()
            })
        } else {
            throw 'fail'
        }


        $(`#${s.domId}_reset`).click(() => {
            if (s.type === FILE  || s.type == STRING || s.type === DROPDOWN) {
                $(`#${s.domId}`).val(s.def)
            } else if (s.type == BOOL) {
                $(`#${s.domId}`).prop('checked', s.def)
            } else {
                throw 'fail'
            }
            save()

        })
    }


}


function getSetting(setting) {
    for (s of allSettings) {
        if (setting === s.propName) {
            const cached = settingsCache[setting];
            return cached !== undefined ? cached : s.def;
        }
    }
    throw "no setting:" + setting
}

module.exports = { initSettings, getSetting, loadSettingsCache }