// A bare Electron window, only used by make-scanned.mjs to draw the pages of scanned.pdf.
const { app, BrowserWindow } = require('electron')
app.whenReady().then(() => new BrowserWindow({ show: false }).loadURL('about:blank'))
