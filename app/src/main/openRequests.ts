import { isAbsolute, resolve } from 'node:path'
import type { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'

// F15: books opened from File Explorer ("Open with", double-click) arrive as a command-line
// argument, either at start-up or, when the app is already running, from a second instance.

/**
 * The file path in a command line, if any. Skips the exe (and, in dev/tests, the app folder)
 * and every Chromium/Electron switch. Relative paths are resolved against `cwd`.
 * Only a path is returned: the renderer reads it like any other book, so a missing, damaged
 * or non-book file gets the usual plain-language message (F15.4).
 */
export function fileFromArgv(argv: readonly string[], cwd: string, isDefaultApp: boolean): string | null {
  const args = argv.slice(isDefaultApp ? 2 : 1).filter((a) => a && !a.startsWith('-'))
  const file = args[0]
  if (!file) return null
  return isAbsolute(file) ? file : resolve(cwd, file)
}

/** The data a second instance hands to the running one (see requestSingleInstanceLock). */
export interface LaunchData {
  argv: string[]
  cwd: string
}

export function isLaunchData(v: unknown): v is LaunchData {
  const d = v as LaunchData | null
  return !!d && Array.isArray(d.argv) && d.argv.every((a) => typeof a === 'string') && typeof d.cwd === 'string'
}

/**
 * Holds the most recent requested path until the page takes it. The page is only told
 * "something is waiting" and then pulls it, so a request that arrives before the page has
 * loaded is never lost.
 */
export class OpenRequests {
  private pending: string | null = null

  request(path: string, win: BrowserWindow | undefined): void {
    this.pending = path
    if (win && !win.isDestroyed()) win.webContents.send(IPC.filesOpenRequested)
  }

  take(): string | null {
    const p = this.pending
    this.pending = null
    return p
  }
}

/** Brings the window to the front, even if it was minimised (F15.3). */
export function bringToFront(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) win.show()
  win.focus()
}
