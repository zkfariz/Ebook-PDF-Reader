import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { createMainWindow, hardenSession, isDev, saveWindowBounds } from './window'
import { setAppMenu } from './menu'
import { registerIpc } from './ipc'
import { registerAppScheme, serveAppProtocol } from './protocol'
import { Store } from './store/store'
import { bringToFront, fileFromArgv, isLaunchData, OpenRequests, type LaunchData } from './openRequests'

// Tests run each app instance against its own empty data folder.
const testDataDir = process.env['EBOOK_READER_USER_DATA']
if (testDataDir) app.setPath('userData', testDataDir)

// F15: one window only. A second start (e.g. double-clicking a book in File Explorer) hands its
// command line to the running app and exits. The lock is per data folder, so tests don't collide.
const launchData: LaunchData = { argv: process.argv, cwd: process.cwd() }
if (!app.requestSingleInstanceLock(launchData)) {
  app.exit(0)
}

registerAppScheme()

const store = new Store(app.getPath('userData'))
const openRequests = new OpenRequests()
let mainWindow: BrowserWindow | undefined

// A book passed at start-up waits until the page asks for it.
const startupFile = fileFromArgv(process.argv, process.cwd(), process.defaultApp === true)
if (startupFile) openRequests.request(startupFile, undefined)

app.on('second-instance', (_e, argv, workingDirectory, additionalData) => {
  // additionalData keeps the original argument order; argv is the fallback.
  const data = isLaunchData(additionalData) ? additionalData : { argv, cwd: workingDirectory }
  const file = fileFromArgv(data.argv, data.cwd, process.defaultApp === true)
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : BrowserWindow.getAllWindows()[0]
  if (file) openRequests.request(file, win)
  if (win) bringToFront(win)
})

app.whenReady().then(async () => {
  serveAppProtocol(join(__dirname, '../renderer'))
  hardenSession()
  setAppMenu(isDev)
  registerIpc(store, openRequests)
  mainWindow = await createMainWindow(store)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow(store).then((w) => (mainWindow = w))
  })
})

// Make sure the last reading position etc. reach the disk before the app exits.
let flushed = false
app.on('before-quit', (e) => {
  if (flushed) return
  e.preventDefault()
  // Quitting fires before windows close, so save their bounds here, then wait for every write.
  void Promise.all(BrowserWindow.getAllWindows().map((w) => saveWindowBounds(w, store)))
    .then(() => store.flushAll())
    .finally(() => {
      flushed = true
      app.quit()
    })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
