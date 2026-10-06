import { BrowserWindow, clipboard, ipcMain, nativeTheme } from 'electron'
import { z } from 'zod'
import { BOOK_EXTENSIONS, IPC, type LocateResult, type Theme } from '@shared/ipc'
import { BookDataSchema, BookIdSchema, LibraryEntrySchema, SettingsPatchSchema } from '@shared/schemas'
import { readBook, showOpenDialog } from './files'
import type { Store } from './store/store'
import type { OpenRequests } from './openRequests'

// The renderer may only ask main to read files that look like books.
const bookPath = z.string().min(1).max(4096).regex(BOOK_EXTENSIONS)

/** Makes Chromium's own colours (scrollbars, form controls, prefers-color-scheme) match the app theme. */
export function applyNativeTheme(theme: Theme | undefined): void {
  nativeTheme.themeSource = theme === 'night' ? 'dark' : theme === 'day' ? 'light' : 'system'
}

/** All renderer → main calls. Every argument is validated before use (architecture.md §4). */
export function registerIpc(store: Store, openRequests: OpenRequests): void {
  ipcMain.handle(IPC.appSystemTheme, (): Theme => (nativeTheme.shouldUseDarkColors ? 'night' : 'day'))

  // ---- files ----
  ipcMain.handle(IPC.filesOpenDialog, (event) => showOpenDialog(BrowserWindow.fromWebContents(event.sender)))
  ipcMain.handle(IPC.filesReadBook, (_e, path: unknown) => readBook(bookPath.parse(path)))
  ipcMain.handle(IPC.filesTakeOpenRequest, () => openRequests.take())

  // ---- library ----
  ipcMain.handle(IPC.libraryList, () => store.listLibrary())
  ipcMain.handle(IPC.libraryUpsert, (_e, entry: unknown) => store.upsertEntry(LibraryEntrySchema.parse(entry)))
  ipcMain.handle(IPC.libraryRemove, (_e, bookId: unknown) => store.removeEntry(BookIdSchema.parse(bookId)))

  ipcMain.handle(IPC.libraryLocate, async (event, rawId: unknown): Promise<LocateResult> => {
    const bookId = BookIdSchema.parse(rawId)
    const path = await showOpenDialog(BrowserWindow.fromWebContents(event.sender))
    if (!path) return { ok: false, reason: 'cancelled' }
    const res = await readBook(path)
    if (!res.ok) return { ok: false, reason: 'unsupported' }
    if (res.bookId !== bookId) return { ok: false, reason: 'different-file', path }
    const entry = await store.getEntry(bookId)
    if (entry) await store.upsertEntry({ ...entry, path, fileName: res.fileName })
    return { ok: true, path }
  })

  ipcMain.handle(IPC.libraryRekey, async (_e, rawId: unknown, rawPath: unknown) => {
    const oldId = BookIdSchema.parse(rawId)
    const res = await readBook(bookPath.parse(rawPath))
    const old = await store.getEntry(oldId)
    if (!res.ok || !old) return { ok: false }
    await store.rekey(oldId, {
      ...old,
      bookId: res.bookId,
      format: res.format,
      path: res.path,
      fileName: res.fileName,
      size: res.size
    })
    return { ok: true }
  })

  // ---- per-book reading data ----
  ipcMain.handle(IPC.bookDataGet, (_e, bookId: unknown) => store.getBookData(BookIdSchema.parse(bookId)))
  ipcMain.handle(IPC.bookDataPut, (_e, bookId: unknown, data: unknown) =>
    store.putBookData(BookIdSchema.parse(bookId), BookDataSchema.parse(data))
  )

  // ---- clipboard ----
  ipcMain.handle(IPC.clipboardWriteText, (_e, text: unknown) => clipboard.writeText(z.string().max(1_000_000).parse(text)))

  // ---- window ----
  ipcMain.handle(IPC.winSetFullScreen, (event, on: unknown) => {
    BrowserWindow.fromWebContents(event.sender)?.setFullScreen(z.boolean().parse(on))
  })

  // ---- settings ----
  ipcMain.handle(IPC.settingsGet, () => store.settings.read())
  ipcMain.handle(IPC.settingsSet, async (_e, raw: unknown) => {
    const patch = SettingsPatchSchema.parse(raw)
    if (patch.theme) applyNativeTheme(patch.theme)
    return store.updateSettings(patch)
  })
}
