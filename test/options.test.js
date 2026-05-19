const { initSettings } = require('../options');
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
});
