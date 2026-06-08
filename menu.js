const { Menu, app } = require('electron');
const { t } = require('./i18n');

function setupAppMenu(mainWindow) {
    const isMac = process.platform === 'darwin';
    
    const template = [
        // { role: 'appMenu' }
        ...(isMac ? [{
            label: app.name || 'Ledgerble',
            submenu: [
                { role: 'about', label: t('menu.about') },
                { type: 'separator' },
                { role: 'services', label: t('menu.services') },
                { type: 'separator' },
                { role: 'hide', label: t('menu.hide') },
                { role: 'hideOthers', label: t('menu.hideOthers') },
                { role: 'unhide', label: t('menu.unhide') },
                { type: 'separator' },
                { role: 'quit', label: t('menu.quit') }
            ]
        }] : []),
        // { role: 'fileMenu' }
        {
            label: t('menu.file'),
            submenu: [
                {
                    label: t('menu.print'),
                    accelerator: 'CmdOrCtrl+P',
                    click: () => {
                        if (mainWindow && mainWindow.webContents) {
                            mainWindow.webContents.executeJavaScript('window.print()');
                        }
                    }
                },
                {
                    label: t('file.print_pdf'),
                    click: () => {
                        if (mainWindow && mainWindow.webContents) {
                            mainWindow.webContents.executeJavaScript('window.api.printToPdf()');
                        }
                    }
                },
                isMac ? { role: 'close', label: t('menu.close') } : { role: 'quit', label: t('menu.quit') }
            ]
        },
        // { role: 'editMenu' }
        {
            label: t('menu.edit'),
            submenu: [
                { role: 'undo', label: t('menu.undo') },
                { role: 'redo', label: t('menu.redo') },
                { type: 'separator' },
                { role: 'cut', label: t('menu.cut') },
                { role: 'copy', label: t('menu.copy') },
                { role: 'paste', label: t('menu.paste') },
                ...(isMac ? [
                    { role: 'pasteAndMatchStyle', label: t('menu.pasteAndMatchStyle') },
                    { role: 'delete', label: t('menu.delete') },
                    { role: 'selectAll', label: t('menu.selectAll') },
                    { type: 'separator' },
                    {
                        label: t('menu.speech'),
                        submenu: [
                            { role: 'startSpeaking', label: t('menu.startSpeaking') },
                            { role: 'stopSpeaking', label: t('menu.stopSpeaking') }
                        ]
                    }
                ] : [
                    { role: 'delete', label: t('menu.delete') },
                    { type: 'separator' },
                    { role: 'selectAll', label: t('menu.selectAll') }
                ])
            ]
        },
        // { role: 'viewMenu' }
        {
            label: t('menu.view'),
            submenu: [
                { role: 'reload', label: t('menu.reload') },
                { role: 'forceReload', label: t('menu.forceReload') },
                { role: 'toggleDevTools', label: t('menu.toggleDevTools') },
                { type: 'separator' },
                { role: 'resetZoom', label: t('menu.resetZoom') },
                { role: 'zoomIn', label: t('menu.zoomIn') },
                { role: 'zoomOut', label: t('menu.zoomOut') },
                { type: 'separator' },
                { role: 'togglefullscreen', label: t('menu.togglefullscreen') }
            ]
        },
        // { role: 'windowMenu' }
        {
            label: t('menu.window'),
            submenu: [
                { role: 'minimize', label: t('menu.minimize') },
                { role: 'zoom', label: t('menu.zoom') },
                ...(isMac ? [
                    { type: 'separator' },
                    { role: 'front', label: t('menu.front') },
                    { type: 'separator' },
                    { role: 'window', label: t('menu.window') }
                ] : [
                    { role: 'close', label: t('menu.close') }
                ])
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    return menu;
}

module.exports = { setupAppMenu };
