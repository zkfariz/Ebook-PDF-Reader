import { BOOK_EXTENSIONS, type BookFormat } from '@shared/ipc'

export interface OpenedBook {
  bookId: string
  path: string
  fileName: string
  format: BookFormat
  data: Uint8Array
}

export type OpenResult =
  | { ok: true; book: OpenedBook }
  | { ok: false; message: string; code?: 'not-found' | 'unsupported' | 'read-failed' }
  | { ok: false; cancelled: true }

export const MSG_UNSUPPORTED = 'Only PDF and EPUB files are supported.'

/** Reads a book from disk through main and maps every failure to a plain-language message. */
export async function openPath(path: string): Promise<OpenResult> {
  if (!BOOK_EXTENSIONS.test(path)) return { ok: false, message: MSG_UNSUPPORTED }

  const res = await window.api.files.readBook(path)
  if (!res.ok) {
    const message = {
      'not-found': 'File not found. It may have been moved or deleted.',
      unsupported: MSG_UNSUPPORTED,
      'read-failed': 'The file could not be read.'
    }[res.error]
    return { ok: false, message, code: res.error }
  }

  const { bookId, fileName, format, data } = res
  return { ok: true, book: { bookId, path: res.path, fileName, format, data } }
}

export async function openWithDialog(): Promise<OpenResult> {
  const path = await window.api.files.openDialog()
  return path ? openPath(path) : { ok: false, cancelled: true }
}

/** Handles a drag-and-drop: type check by name first, then the real path from preload. */
export async function openDropped(file: File): Promise<OpenResult> {
  if (!BOOK_EXTENSIONS.test(file.name)) return { ok: false, message: MSG_UNSUPPORTED }
  const path = window.api.files.getPathForFile(file)
  if (!path) return { ok: false, message: 'This file could not be opened. Save it to your computer first.' }
  return openPath(path)
}
