// The only reader API the UI may use (architecture.md §5).
// It grew slice by slice: S1 open/mount/relocate · S2 navigation & zoom · S3 EPUB · S6 TOC ·
// S7 bookmarks · S8 search · S9 selection and highlights.
import type { BookFormat, Theme } from '@shared/ipc'
import type { Anchor, Highlight, OcrLine } from '@shared/schemas'

export type Loc = string

export interface BookMeta {
  title?: string
  author?: string
}

export interface Progress {
  loc: Loc
  current: number
  total: number
  fraction: number
  label: string
  atStart: boolean
  atEnd: boolean
  /** Id of the table-of-contents entry for the current chapter (once getToc() has run). */
  tocId?: string
}

/** One search result (F09). `anchor` pins the exact matched text (same shape as highlights). */
export interface SearchHit {
  id: string
  loc: Loc
  anchor: Anchor
  pre: string
  match: string
  post: string
  /** Where it is, for the result list: "p. 12" (PDF) or the chapter title (EPUB). */
  label: string
}

/** Text the reader has selected (F11): where it is, what it says, and where to show the popup. */
export interface TextSelection {
  anchor: Anchor
  text: string
  /** Window coordinates of the selection, for placing the popup. */
  rect: DOMRect
}

/** What an adapter needs to draw a highlight. */
export type RenderHighlight = Pick<Highlight, 'id' | 'anchor' | 'text' | 'color' | 'note'> & { hasNote: boolean }

export interface TocItem {
  /** Stable id within this book's TOC, e.g. "1.0" (= second top-level entry, its first child). */
  id: string
  label: string
  /** Where the entry leads; missing for entries that link nowhere (e.g. web links in PDFs). */
  target?: Loc
  children: TocItem[]
}

export type PdfZoom = number | 'fit-width' | 'fit-page' // number = 1.0 for 100 %

export type EpubFont = 'serif' | 'sans'

export interface ViewSettings {
  pdf?: { zoom: PdfZoom }
  epub?: { fontSize: number; fontFamily: EpubFont }
}

/** What the toolbar shows about the current view. */
export type ViewState =
  | { kind: 'pdf'; zoom: PdfZoom; percent: number } // percent = effective zoom, also for fit modes
  | { kind: 'epub'; fontSize: number; fontFamily: EpubFont }

export type ReaderErrorKind = 'password-required' | 'wrong-password' | 'damaged' | 'drm'

export class ReaderError extends Error {
  constructor(readonly kind: ReaderErrorKind, message?: string) {
    super(message ?? kind)
    this.name = 'ReaderError'
  }
}

/** What a PDF page offers as text (F16): its own, text recognised from the picture, a picture still to read, or nothing found. */
export type PageTextState = 'text' | 'recognised' | 'picture' | 'blank'

/** Reading text from scanned PDF pages (F16). Only the PDF adapter has it. */
export interface PageOcr {
  /** Loads recognised pages saved earlier. Call after open() and before mount(). */
  load(saved: Record<string, { lines: OcrLine[] }>): void
  pageState(page: number): Promise<PageTextState>
  /** Reads a picture-only page. The text is usable at once (search, selection, highlights); the caller saves the lines. */
  recognise(page: number): Promise<OcrLine[]>
}

export interface ReaderEvents {
  relocate: Progress
  view: ViewState
  /** Text was selected (null = selection cleared / a new click started). */
  select: TextSelection | null
  /** The selection cannot become a highlight (F11.4). */
  'select-error': { message: string; rect: DOMRect }
  /** A highlight was clicked (F11.3). */
  'highlight-click': { id: string; rect: DOMRect }
  /** A PDF highlight's offsets no longer matched its text and were found again: save the new anchor. */
  'highlight-repaired': { id: string; anchor: Anchor }
  /** A highlight's text could not be found on its page any more (shown with ⚠ in the list). */
  'highlight-missing': { id: string }
}

export interface ReaderAdapter {
  readonly format: BookFormat
  /** Present for PDF only: text recognition for scanned pages (F16). */
  readonly ocr?: PageOcr
  /** Throws ReaderError. The data is copied, never modified. */
  open(data: Uint8Array, opts?: { password?: string }): Promise<BookMeta>
  /**
   * Shows the book in the container, starting at `startAt` (a saved position) if given;
   * resolves once the first page is on screen.
   */
  mount(container: HTMLElement, startAt?: Loc): Promise<void>
  destroy(): void

  goTo(loc: Loc): Promise<void>
  /** Page number (PDF) or location number (EPUB), 1-based. Out-of-range numbers are ignored. */
  goToNumber(n: number): Promise<void>
  next(): Promise<void>
  prev(): Promise<void>
  first(): Promise<void>
  last(): Promise<void>
  /** Draws exactly these highlights (full replace); redrawn after every page change and re-layout (F11). */
  setHighlights(highlights: RenderHighlight[]): void
  clearSelection(): void
  /** Short "where" text for an anchor: "p. 12" (PDF) or the chapter title (EPUB). */
  describe(anchor: Anchor): string

  /** Location to store for a bookmark on the current screen (F06); null before the first page. */
  bookmarkLoc(): Loc | null
  /** Is this saved location on the current screen? (Bookmark button state, F06.1) */
  containsLoc(loc: Loc): boolean
  /** Book order of two locations, for sorting lists. */
  compareLocs(a: Loc, b: Loc): number

  /** The book's table of contents (F10); empty if it has none. Call after mount(). */
  getToc(): Promise<TocItem[]>
  /**
   * Searches the whole book, case- and accent-insensitive (F09). Yields results in book order,
   * in batches, so the list fills in while the search runs. Stops when `signal` aborts.
   */
  search(query: string, signal: AbortSignal): AsyncIterable<SearchHit[]>
  /** Outlines one search result on the page (null removes the outline). Call after goTo(hit.loc). */
  showSearchMatch(hit: SearchHit | null): void
  /** False when the book has no text at all (e.g. a scanned PDF), so search can explain why (F09.4). */
  hasText(): Promise<boolean>

  /** True when the reading pane is scrolled to that edge (or does not scroll at all). */
  isAtEdge(edge: 'top' | 'bottom'): boolean

  setView(view: ViewSettings): Promise<void>
  /** Day/night colours for the book content (F08). Safe to call before mount. */
  setTheme(theme: Theme): void
  zoomIn(): Promise<void>
  zoomOut(): Promise<void>

  on<E extends keyof ReaderEvents>(event: E, cb: (detail: ReaderEvents[E]) => void): () => void
}

/** Tiny typed event emitter shared by adapters. */
export class Emitter<Events> {
  private listeners = new Map<keyof Events, Set<(detail: never) => void>>()

  on<E extends keyof Events>(event: E, cb: (detail: Events[E]) => void): () => void {
    const set = this.listeners.get(event) ?? new Set()
    set.add(cb as (detail: never) => void)
    this.listeners.set(event, set)
    return () => set.delete(cb as (detail: never) => void)
  }

  emit<E extends keyof Events>(event: E, detail: Events[E]): void {
    this.listeners.get(event)?.forEach((cb) => (cb as (d: Events[E]) => void)(detail))
  }

  clear(): void {
    this.listeners.clear()
  }
}
