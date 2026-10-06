import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { BrowserWindow, dialog } from 'electron'
import type { ReadBookResult } from '@shared/ipc'
import { sniffFormat } from './sniff'

export async function showOpenDialog(win: BrowserWindow | null): Promise<string | null> {
  const options: Electron.OpenDialogOptions = {
    title: 'Open book',
    properties: ['openFile'],
    filters: [
      { name: 'Books', extensions: ['pdf', 'epub'] },
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'EPUB', extensions: ['epub'] }
    ]
  }
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  return result.canceled ? null : (result.filePaths[0] ?? null)
}

// Reads the whole book (read-only) and identifies it by SHA-256 of its content (data-model.md §1).
export async function readBook(path: string): Promise<ReadBookResult> {
  let buf: Buffer
  try {
    buf = await readFile(path)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    return { ok: false, error: code === 'ENOENT' ? 'not-found' : 'read-failed' }
  }

  const fileName = basename(path)
  const format = sniffFormat(buf, fileName)
  if (!format) return { ok: false, error: 'unsupported' }

  const bookId = createHash('sha256').update(buf).digest('hex')
  return { ok: true, bookId, path, fileName, size: buf.length, format, data: buf }
}
