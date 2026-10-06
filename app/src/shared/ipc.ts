// IPC channel names and the typed API exposed on window.api.
// Every channel used by main or preload must be listed here (architecture.md §4).
import type { BookData, LibraryEntry, Settings, SettingsPatch } from './schemas'

export const IPC = {
  appSystemTheme: 'app:systemTheme',
  filesOpenDialog: 'files:openDialog',
  filesReadBook: 'files:readBook',
  filesTakeOpenRequest: 'files:takeOpenRequest',
  filesOpenRequested: 'files:openRequested', // main → renderer event (F15)
  libraryList: 'library:list',
  libraryUpsert: 'library:upsert',
  libraryRemove: 'library:remove',
  libraryLocate: 'library:locate',
  libraryRekey: 'library:rekey',
  bookDataGet: 'bookData:get',
  bookDataPut: 'bookData:put',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  winSetFullScreen: 'win:setFullScreen',
  winFullScreenChanged: 'win:fullScreenChanged', // main → renderer event
  clipboardWriteText: 'clipboard:writeText'
} as const

export type Theme = 'day' | 'night'
export type BookFormat = 'pdf' | 'epub'

export const BOOK_EXTENSIONS = /\.(pdf|epub)$/i

export type ReadBookResult =
  | { ok: true; bookId: string; path: string; fileName: string; size: number; format: BookFormat; data: Uint8Array }
  | { ok: false; error: 'not-found' | 'unsupported' | 'read-failed' }

export interface LibraryListItem extends LibraryEntry {
  /** The file is no longer at its saved path. */
  missing: boolean
}

export type LocateResult =
  | { ok: true; path: string }
  | { ok: false; reason: 'cancelled' | 'unsupported' }
  | { ok: false; reason: 'different-file'; path: string }

export interface Api {
  app: {
    systemTheme(): Promise<Theme>
  }
  files: {
    /** Shows the Open dialog; resolves to the chosen path, or null if cancelled. */
    openDialog(): Promise<string | null>
    readBook(path: string): Promise<ReadBookResult>
    /** Real disk path of a dropped File ('' for files that do not come from disk). */
    getPathForFile(file: object): string
    /** A book path waiting to be opened (from File Explorer, F15), or null. Each request is returned once. */
    takeOpenRequest(): Promise<string | null>
    /** Called when File Explorer asks to open a book; then call takeOpenRequest(). Returns an unsubscribe function. */
    onOpenRequested(cb: () => void): () => void
  }
  library: {
    list(): Promise<LibraryListItem[]>
    upsert(entry: LibraryEntry): Promise<void>
    /** Removes the entry and its bookmarks/highlights/notes. Never touches the book file. */
    remove(bookId: string): Promise<void>
    /** Lets the user pick the new location of a missing book (F01.5). */
    locate(bookId: string): Promise<LocateResult>
    /** Re-attaches a book's reading data to a changed file the user chose anyway. */
    rekey(bookId: string, path: string): Promise<{ ok: boolean }>
  }
  bookData: {
    get(bookId: string): Promise<BookData>
    put(bookId: string, data: BookData): Promise<void>
  }
  settings: {
    get(): Promise<Settings>
    set(patch: SettingsPatch): Promise<Settings>
  }
  clipboard: {
    /** Copy text (F11 popup "Copy"); the renderer's own clipboard permission is denied on purpose. */
    writeText(text: string): Promise<void>
  }
  win: {
    setFullScreen(on: boolean): Promise<void>
    /** Called whenever the window enters/leaves full screen; returns an unsubscribe function. */
    onFullScreenChange(cb: (on: boolean) => void): () => void
  }
}
