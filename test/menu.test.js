const { setupAppMenu } = require('../menu');
const { Menu, app } = require('electron');

jest.mock('electron', () => ({
    app: {
        name: 'Ledgerble'
    },
    Menu: {
        buildFromTemplate: jest.fn(template => template),
        setApplicationMenu: jest.fn()
    }
}));

describe('App Menu', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create a File menu with Print option', () => {
        const mockWin = {
            webContents: {
                executeJavaScript: jest.fn()
            }
        };

        const template = setupAppMenu(mockWin);
        
        // Find the "File" menu
        const fileMenu = template.find(item => item.label === 'File');
        expect(fileMenu).toBeDefined();

        // Find "Print" in the "File" submenu
        const printOption = fileMenu.submenu.find(item => item.label === 'Print');
        expect(printOption).toBeDefined();
        expect(printOption.accelerator).toBe('CmdOrCtrl+P');

        // Test the click handler
        printOption.click();
        expect(mockWin.webContents.executeJavaScript).toHaveBeenCalledWith('window.print()');
    });
});
