import { join } from 'node:path'
import { BrowserWindow, nativeTheme, screen, session } from 'electron'
import { applyNativeTheme } from './ipc'
import { IPC } from '@shared/ipc'
import type { WindowBounds } from '@shared/schemas'
import type { Store } from './store/store'
import { isAllowedUrl } from './security'
import { APP_ORIGIN } from './protocol'

const devServerUrl = process.env['ELECTRON_RENDERER_URL']
export const isDev = Boolean(devServerUrl)

export function hardenSession(): void {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isAllowedUrl(details.url, devServerUrl)
    if (!allowed) console.warn(`[offline] blocked ${details.url}`)
    callback({ cancel: !allowed })
  })
  // No permission (camera, notifications, …) is ever needed.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
}

/** Saved bounds are reused only if they are still mostly on a connected screen. */
function visibleBounds(saved: WindowBounds | undefined): Partial<WindowBounds> {
  if (!saved) return { width: 1280, height: 860 }
  const area = screen.getDisplayMatching(saved).workArea
  const overlapW = Math.min(saved.x + saved.width, area.x + area.width) - Math.max(saved.x, area.x)
  const overlapH = Math.min(saved.y + saved.height, area.y + area.height) - Math.max(saved.y, area.y)
  if (overlapW < 200 || overlapH < 100) return { width: saved.width, height: saved.height }
  return saved
}

/** Queues the window's normal (un-maximised) bounds for saving. */
export function saveWindowBounds(win: BrowserWindow, store: Store): Promise<unknown> {
  if (win.isDestroyed()) return Promise.resolve()
  const { x, y, width, height } = win.getNormalBounds()
  return store.updateSettings({ window: { x, y, width, height, maximized: win.isMaximized() } })
}

export async function createMainWindow(store: Store): Promise<BrowserWindow> {
  const settings = await store.settings.read()
  const saved = settings.window
  applyNativeTheme(settings.theme)
  const bounds = visibleBounds(saved)
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 720,
    minHeight: 480,
    show: false,
    // Matches --bg so the window never flashes the wrong colour before the page paints.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#16171A' : '#F4F1EA',
    title: 'Ebook Reader',
    // Packaged: Windows takes the icon from the .exe (set by electron-builder). Dev: use the source PNG.
    icon: isDev ? join(__dirname, '../../build/icon.png') : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: isDev
    }
  })

  win.once('ready-to-show', () => {
    if (saved?.maximized) win.maximize()
    win.show()
  })
  // Tell the page when full screen changes (F13), whoever triggered it.
  win.on('enter-full-screen', () => win.webContents.send(IPC.winFullScreenChanged, true))
  win.on('leave-full-screen', () => win.webContents.send(IPC.winFullScreenChanged, false))

  // Remember size/position for next time (also saved on quit, see index.ts).
  win.on('close', () => void saveWindowBounds(win, store))
  // The app has its own zoom for books; disable Chromium page zoom (pinch, Ctrl+wheel on the UI).
  void win.webContents.setVisualZoomLevelLimits(1, 1)

  // Never navigate away from the app or open new windows.
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  // Sub-frames (EPUB sections) may only show book content loaded as blob: URLs.
  win.webContents.on('will-frame-navigate', (e) => {
    if (!e.isMainFrame && !/^(blob:|about:blank)/.test(e.url)) e.preventDefault()
  })

  if (!isDev) {
    win.webContents.on('before-input-event', (e, input) => {
      const devToolsCombo = input.control && input.shift && input.key.toLowerCase() === 'i'
      if (devToolsCombo || input.key === 'F12') e.preventDefault()
    })
  }

  win.loadURL(devServerUrl ?? `${APP_ORIGIN}/index.html`)

  return win
}
