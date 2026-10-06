import type { Anchor, BookData, Bookmark, Highlight, LibraryEntry } from '@shared/schemas'
import type { OpenedBook } from '../../app/openBook'
import type { BookMeta, Loc, Progress, ViewSettings, ViewState } from '../../reader/ReaderAdapter'

/**
 * Everything the app remembers about the open book (F04, F05, F03.4):
 * its library entry, last position, and zoom / text size. Saved through main on every change;
 * main merges bursts of writes, so saving on each page turn is cheap.
 */
export class BookSession {
  private data: BookData | null = null
  private existing: LibraryEntry | undefined
  private entry: LibraryEntry | null = null
  readonly ready: Promise<void>

  constructor(private readonly book: OpenedBook) {
    this.ready = this.load()
  }

  private async load(): Promise<void> {
    const [data, list] = await Promise.all([window.api.bookData.get(this.book.bookId), window.api.library.list()])
    this.data = data
    this.existing = list.find((e) => e.bookId === this.book.bookId)
  }

  /** Last saved position, to reopen the book there (F05). */
  get position(): Loc | undefined {
    return this.data?.position
  }

  /** Saved zoom (PDF) or text size/font (EPUB) for this book (F03.4). */
  get savedView(): ViewSettings | null {
    const view = this.data?.view
    if (this.book.format === 'pdf') return view?.pdf ? { pdf: view.pdf } : null
    return view?.epub ? { epub: view.epub } : null
  }

  /** Adds the book to the library, or refreshes its entry (path may have changed, F04.3). */
  recordOpened(meta: BookMeta, fallbackTitle: string): void {
    const now = new Date().toISOString()
    const { bookId, format, path, fileName, data } = this.book
    this.entry = {
      bookId,
      format,
      path,
      fileName,
      size: data.byteLength,
      title: meta.title ?? fallbackTitle,
      author: meta.author ?? null,
      addedAt: this.existing?.addedAt ?? now,
      lastOpened: now,
      progress: this.existing?.progress ?? 0
    }
    void window.api.library.upsert(this.entry)
  }

  savePosition(p: Progress): void {
    if (this.data && this.data.position !== p.loc) {
      this.data = { ...this.data, position: p.loc }
      void window.api.bookData.put(this.book.bookId, this.data)
    }
    if (this.entry && Number.isFinite(p.fraction) && this.entry.progress !== p.fraction) {
      this.entry = { ...this.entry, progress: p.fraction }
      void window.api.library.upsert(this.entry)
    }
  }

  // ---------- bookmarks (F06) ----------

  get bookmarks(): Bookmark[] {
    return this.data?.bookmarks ?? []
  }

  /** Adds a bookmark and saves; returns the new list. */
  addBookmark(loc: Loc, label: string): Bookmark[] {
    const bookmark: Bookmark = {
      id: `bm_${crypto.randomUUID()}`,
      loc,
      label: label.slice(0, 300),
      createdAt: new Date().toISOString()
    }
    return this.setBookmarks([...this.bookmarks, bookmark])
  }

  /** Removes bookmarks by id and saves; returns the new list. */
  removeBookmarks(ids: string[]): Bookmark[] {
    return this.setBookmarks(this.bookmarks.filter((b) => !ids.includes(b.id)))
  }

  private setBookmarks(bookmarks: Bookmark[]): Bookmark[] {
    if (!this.data) return []
    this.data = { ...this.data, bookmarks }
    void window.api.bookData.put(this.book.bookId, this.data)
    return bookmarks
  }

  // ---------- highlights and notes (F11, F12) ----------

  get highlights(): Highlight[] {
    return this.data?.highlights ?? []
  }

  addHighlight(anchor: Anchor, text: string, color: Highlight['color']): Highlight[] {
    const now = new Date().toISOString()
    const highlight: Highlight = { id: `hl_${crypto.randomUUID()}`, anchor, text: text.slice(0, 20000), color, createdAt: now, updatedAt: now }
    return this.setHighlights([...this.highlights, highlight])
  }

  updateHighlight(id: string, patch: Partial<Pick<Highlight, 'color' | 'anchor'>> & { note?: string | null }): Highlight[] {
    return this.setHighlights(
      this.highlights.map((h) => {
        if (h.id !== id) return h
        const next: Highlight = { ...h, ...patch, note: undefined, updatedAt: new Date().toISOString() }
        const note = patch.note === undefined ? h.note : (patch.note ?? '').trim()
        if (note) next.note = note.slice(0, 5000) // an empty note is stored as no note (F12.2)
        else delete next.note
        return next
      })
    )
  }

  removeHighlight(id: string): Highlight[] {
    return this.setHighlights(this.highlights.filter((h) => h.id !== id))
  }

  private setHighlights(highlights: Highlight[]): Highlight[] {
    if (!this.data) return []
    this.data = { ...this.data, highlights }
    void window.api.bookData.put(this.book.bookId, this.data)
    return highlights
  }

  saveView(v: ViewState): void {
    if (!this.data) return
    const view = v.kind === 'pdf' ? { pdf: { zoom: v.zoom } } : { epub: { fontSize: v.fontSize, fontFamily: v.fontFamily } }
    if (JSON.stringify(view) === JSON.stringify(this.data.view)) return
    this.data = { ...this.data, view }
    void window.api.bookData.put(this.book.bookId, this.data)
  }
}
