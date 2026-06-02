const { initSettings, getSetting } = require('../options');
const { getAvailableLocales } = require('../i18n');

// Mock DOM
global.$ = jest.fn((selector) => {
    return {
        html: jest.fn(),
        val: jest.fn(() => 'auto'),
        change: jest.fn(),
        click: jest.fn()
    };
});

describe('options.js UI', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock the window.api for settings cache
        global.window = {
            api: {
                settings: {
                    get: jest.fn(),
                    set: jest.fn(),
                    getAll: jest.fn(() => ({}))
                }
            }
        };
        // Mock jQuery html insertion
        global.$ = jest.fn().mockReturnValue({
            html: jest.fn(htmlStr => {
                global.lastHtml = htmlStr;
            }),
            val: jest.fn().mockReturnValue('auto'),
            change: jest.fn(),
            click: jest.fn(),
            prop: jest.fn()
        });
    });

    it('should render a select dropdown for options.locale', () => {
        initSettings(() => 'test');
        expect(global.lastHtml).toContain('<select id="options_locale">');
        const locales = getAvailableLocales();
        for (const loc of ['auto', ...locales]) {
            expect(global.lastHtml).toContain(`<option value="${loc}">${loc}</option>`);
        }
    });

    it('should render a select dropdown for options.overview.catRule with correct options', () => {
        initSettings(() => 'test');
        expect(global.lastHtml).toContain('<select id="options_overview_catRule">');
        // All valid rule values must appear as options
        for (const val of ['top3', 'top5', 'top8', 'p75', 'all']) {
            expect(global.lastHtml).toContain(`value="${val}"`);
        }
    });

    it('getSetting should return top5 as default for options.overview.catRule', () => {
        // settingsCache is empty (no stored value), so default should be top5
        expect(getSetting('options.overview.catRule')).toBe('top5');
    });

    it('should re-render options table in the new language when locale changes', () => {
        let changeCallback = null;
        let htmlCalls = [];
        
        global.$ = jest.fn().mockImplementation((selector) => {
            return {
                html: jest.fn(htmlStr => {
                    htmlCalls.push(htmlStr);
                    global.lastHtml = htmlStr;
                }),
                val: jest.fn().mockReturnValue('de'),
                change: jest.fn(cb => {
                    if (selector === '#options_locale') {
                        changeCallback = cb;
                    }
                }),
                click: jest.fn(),
                prop: jest.fn()
            };
        });

        initSettings(() => 'test');
        
        // Initial render should contain English heading
        expect(global.lastHtml).toContain('<th>Setting</th>');
        expect(global.lastHtml).not.toContain('<th>Sprache</th>');

        // Trigger locale change
        if (changeCallback) {
            changeCallback();
        }

        // After change, it should have updated global.lastHtml with the German heading "Einstellung"
        expect(global.lastHtml).toContain('<th>Einstellung</th>');
    });
});
