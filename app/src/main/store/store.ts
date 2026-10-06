import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  BookDataSchema,
  BookIdSchema,
  defaultSettings,
  emptyBookData,
  emptyOcr,
  emptyLibrary,
  LibraryFileSchema,
  OcrFileSchema,
  SettingsSchema,
  sortLibrary,
  type BookData,
  type LibraryEntry,
  type OcrFile,
  type OcrLine,
  type Settings
} from '@shared/schemas'
import type { LibraryListItem } from '@shared/ipc'
import { JsonFile } from './jsonFile'


/**
 * All persistent app data under one folder (data-model.md):
 *   settings.json · library.json · books/<bookId>.json · books/<bookId>.ocr.json (F16)
 * Book files themselves are never written.
 */
export class Store {
  readonly settings: JsonFile<typeof SettingsSchema>
  private readonly library: JsonFile<typeof LibraryFileSchema>
  private readonly bookFiles = new Map<string, JsonFile<typeof BookDataSchema>>()
  private readonly ocrFiles = new Map<string, JsonFile<typeof OcrFileSchema>>()

  constructor(private readonly dir: string) {
    this.settings = new JsonFile(join(dir, 'settings.json'), SettingsSchema, defaultSettings)
    this.library = new JsonFile(join(dir, 'library.json'), LibraryFileSchema, emptyLibrary)
  }

  // ---------- library ----------

  async listLibrary(): Promise<LibraryListItem[]> {
    const lib = await this.library.read()
    return sortLibrary(Object.values(lib.books)).map((e) => ({ ...e, missing: !existsSync(e.path) }))
  }

  async getEntry(bookId: string): Promise<LibraryEntry | undefined> {
    return (await this.library.read()).books[bookId]
  }

  async upsertEntry(entry: LibraryEntry): Promise<void> {
    const lib = await this.library.read()
    lib.books[entry.bookId] = entry
    await this.library.write(lib)
  }

  /** Removes the entry and its reading data. The book file on disk is never touched (F04.2). */
  async removeEntry(bookId: string): Promise<void> {
    BookIdSchema.parse(bookId)
    const lib = await this.library.read()
    delete lib.books[bookId]
    await this.library.write(lib)
    await this.bookFile(bookId).remove()
    this.bookFiles.delete(bookId)
    await this.ocrFile(bookId).remove() // recognised text goes with the book (F16.9)
    this.ocrFiles.delete(bookId)
  }

  /** Moves an entry and its reading data to a new id (user chose a changed file for a missing book). */
  async rekey(oldId: string, entry: LibraryEntry): Promise<void> {
    const data = await this.getBookData(oldId)
    await this.putBookData(entry.bookId, data)
    const ocr = await this.getOcr(oldId)
    if (Object.keys(ocr.pages).length > 0) await this.ocrFile(entry.bookId).write(ocr)
    const lib = await this.library.read()
    delete lib.books[oldId]
    lib.books[entry.bookId] = entry
    await this.library.write(lib)
    if (oldId !== entry.bookId) {
      await this.bookFile(oldId).remove()
      this.bookFiles.delete(oldId)
      await this.ocrFile(oldId).remove()
      this.ocrFiles.delete(oldId)
    }
  }

  // ---------- per-book reading data ----------

  getBookData(bookId: string): Promise<BookData> {
    return this.bookFile(bookId).read()
  }

  putBookData(bookId: string, data: BookData): Promise<void> {
    return this.bookFile(bookId).write(data)
  }

  // ---------- recognised text of scanned PDFs (F16) ----------

  getOcr(bookId: string): Promise<OcrFile> {
    return this.ocrFile(bookId).read()
  }

  /** Adds (or replaces) one recognised page. Bursts of pages are merged into few disk writes. */
  async putOcrPage(bookId: string, page: number, lines: OcrLine[]): Promise<void> {
    const file = this.ocrFile(bookId)
    const data = await file.read()
    data.pages[String(page)] = { lines }
    await file.write(data)
  }

  // ---------- settings ----------

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    const next = { ...(await this.settings.read()), ...patch }
    await this.settings.write(next)
    return next
  }

  /** Waits for every pending write (called before the app quits). */
  async flushAll(): Promise<void> {
    await Promise.all([this.settings.flush(), this.library.flush(), ...[...this.bookFiles.values()].map((f) => f.flush()),
      ...[...this.ocrFiles.values()].map((f) => f.flush())
    ])
  }

  private ocrFile(bookId: string): JsonFile<typeof OcrFileSchema> {
    BookIdSchema.parse(bookId)
    let file = this.ocrFiles.get(bookId)
    if (!file) {
      file = new JsonFile(join(this.dir, 'books', `${bookId}.ocr.json`), OcrFileSchema, emptyOcr)
      this.ocrFiles.set(bookId, file)
    }
    return file
  }

  private bookFile(bookId: string): JsonFile<typeof BookDataSchema> {
    BookIdSchema.parse(bookId) // the id becomes a file name: only 64 hex chars are allowed
    let file = this.bookFiles.get(bookId)
    if (!file) {
      file = new JsonFile(join(this.dir, 'books', `${bookId}.json`), BookDataSchema, emptyBookData)
      this.bookFiles.set(bookId, file)
    }
    return file
  }
}
