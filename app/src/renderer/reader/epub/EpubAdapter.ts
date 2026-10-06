import type { Theme } from '@shared/ipc'
import type { Anchor } from '@shared/schemas'
import {
  makeBook,
  type FoliateBook,
  type FoliateRelocateDetail,
  type FoliateTocItem,
  type FoliateView
} from 'foliate-js/view.js'
import {
  Emitter,
  ReaderError,
  type BookMeta,
  type EpubFont,
  type Loc,
  type Progress,
  type ReaderAdapter,
  type ReaderEvents,
  type RenderHighlight,
  type SearchHit,
  type TocItem,
  type ViewSettings
} from '../ReaderAdapter'
import { epubHasDrm } from './drm'
import { cfiStart, compareCfi, rangeContains } from './locs'
import { searchEpub, sectionLabels } from './epubSearch'
import { EpubMarks } from './EpubMarks'
import { bookStyles, FONT_SIZE } from './epubStyles'
import { authors, clamp, forwardInput, plainText, settled } from './helpers'
import './epub.css'

export { FONT_SIZE }

const WHEEL_FLIP_COOLDOWN = 300 // ms: one wheel "flick" (or a trackpad swipe) turns one page, not several

export class EpubAdapter implements ReaderAdapter {
  readonly format = 'epub' as const
  private book?: FoliateBook
  private view?: FoliateView
  private pane?: HTMLElement
  private marks?: EpubMarks
  private highlights: RenderHighlight[] = []
  private fontSize = FONT_SIZE.default
  private fontFamily: EpubFont = 'serif'
  private total = 0
  private events = new Emitter<ReaderEvents>()
  private destroyed = false
  private navChain: Promise<void> = Promise.resolve()
  private navQueued = 0
  private lastWheelFlip = 0
  private tocIdByHref = new Map<string, string>()
  private labels?: (string | undefined)[]
  private lastRelocate?: FoliateRelocateDetail

  on = this.events.on.bind(this.events)

  async open(data: Uint8Array): Promise<BookMeta> {
    const file = new File([data.slice()], 'book.epub', { type: 'application/epub+zip' })
    let drm: boolean
    try {
      drm = await epubHasDrm(file)
    } catch (err) {
      throw new ReaderError('damaged', String(err))
    }
    if (drm) throw new ReaderError('drm')

    try {
      this.book = await makeBook(file)
    } catch (err) {
      throw new ReaderError('damaged', err instanceof Error ? err.message : String(err))
    }
    if (!this.book.sections?.length) throw new ReaderError('damaged', 'no sections')

    const meta = this.book.metadata ?? {}
    return { title: plainText(meta.title), author: authors(meta.author) }
  }

  async mount(pane: HTMLElement, startAt?: Loc): Promise<void> {
    if (!this.book) return
    this.pane = pane
    pane.classList.add('epub-pane')
    // The wheel over the page margins (outside the book's own frames) turns pages too.
    pane.addEventListener('wheel', this.onWheel, { passive: false })
    const view = document.createElement('foliate-view') as FoliateView
    view.className = 'epub-view'
    view.addEventListener('relocate', ((e: CustomEvent<FoliateRelocateDetail>) => this.emitRelocate(e.detail)) as EventListener)
    view.addEventListener('load', this.onSectionLoad as EventListener)
    // External links in books do nothing (no network; v1 scope).
    view.addEventListener('external-link', (e) => e.preventDefault())
    this.marks = new EpubMarks(view, this.events)
    pane.append(view)
    this.view = view

    await view.open(this.book)
    if (this.destroyed) return
    const r = view.renderer
    r.setAttribute('flow', 'paginated')
    r.setAttribute('max-column-count', '1') // single page, never a spread (F07.1)
    r.setAttribute('max-inline-size', '680px') // ≈ 70 characters per line
    r.setAttribute('margin', '40px')
    r.setAttribute('gap', '6%')
    // No 'animated' attribute: page turns are instant (F07.2).
    this.applyStyles()
    this.marks.setHighlights(this.highlights) // foliate can draw only once the book is open
    await view.init(startAt ? { lastLocation: startAt } : {})
    await settled(view)
    this.emitView()
  }

  destroy(): void {
    this.destroyed = true
    this.view?.close()
    this.view?.remove()
    this.pane?.classList.remove('epub-pane')
    this.pane?.removeEventListener('wheel', this.onWheel)
    this.events.clear()
  }

  // ---------- navigation ----------

  /**
   * foliate ignores navigation while a page turn is still settling (~100 ms), which would drop a
   * quick second key press. Run navigation one after another instead; at most one call waits,
   * so holding a key down does not keep turning pages after it is released.
   */
  private navigate(fn: () => Promise<unknown>): Promise<void> {
    if (this.navQueued >= 2) return this.navChain
    this.navQueued++
    this.navChain = this.navChain
      .then(async () => void (this.destroyed ? undefined : await fn()))
      .catch((err) => console.error('EPUB navigation failed', err))
      .finally(() => void this.navQueued--)
    return this.navChain
  }

  goTo(loc: Loc): Promise<void> {
    return this.navigate(async () => this.view?.goTo(loc))
  }

  goToNumber(n: number): Promise<void> {
    if (!this.view || !Number.isInteger(n) || n < 1 || n > this.total) return Promise.resolve()
    return this.navigate(async () => this.view?.goToFraction((n - 1) / this.total))
  }

  next = () => this.navigate(async () => this.view?.next())
  prev = () => this.navigate(async () => this.view?.prev())

  first(): Promise<void> {
    return this.navigate(async () => {
      const r = this.view?.renderer
      if (r) await r.goTo({ index: r.sections.findIndex((s) => s.linear !== 'no'), anchor: 0 })
    })
  }

  last(): Promise<void> {
    return this.navigate(async () => {
      const r = this.view?.renderer
      if (r) await r.goTo({ index: r.sections.findLastIndex((s) => s.linear !== 'no'), anchor: 1 })
    })
  }

  /** Paginated text never scrolls, so ↑/↓ always turn the page. */
  isAtEdge(): boolean {
    return true
  }

  // ---------- search (F09) and highlights (F11) ----------

  search(query: string, signal: AbortSignal): AsyncIterable<SearchHit[]> {
    return this.view ? searchEpub(this.view, query, signal) : (async function* () {})()
  }

  async hasText(): Promise<boolean> {
    return true // EPUBs are text by nature
  }

  showSearchMatch(hit: SearchHit | null): void {
    this.marks?.setSearch(hit)
  }

  setHighlights(highlights: RenderHighlight[]): void {
    this.highlights = highlights
    this.marks?.setHighlights(highlights)
  }

  clearSelection(): void {
    this.marks?.clearSelection()
  }

  /** The chapter a CFI belongs to. */
  describe(anchor: Anchor): string {
    const view = this.view
    if (anchor.kind !== 'epub' || !view) return ''
    this.labels ??= sectionLabels(view)
    try {
      const index = view.resolveNavigation(anchor.cfi)?.index
      return (index !== undefined && this.labels[index]) || ''
    } catch {
      return ''
    }
  }

  // ---------- locations for bookmarks (F06) ----------

  bookmarkLoc(): Loc | null {
    return this.lastRelocate ? cfiStart(this.lastRelocate.cfi) : null
  }

  containsLoc(loc: Loc): boolean {
    return this.lastRelocate ? rangeContains(this.lastRelocate.cfi, loc) : false
  }

  compareLocs(a: Loc, b: Loc): number {
    return compareCfi(a, b)
  }

  // ---------- table of contents (F10) ----------

  async getToc(): Promise<TocItem[]> {
    const toc = this.view?.book.toc ?? []
    this.tocIdByHref.clear()
    const convert = (items: FoliateTocItem[], prefix: string): TocItem[] =>
      items.map((it, i) => {
        const id = prefix ? `${prefix}.${i}` : String(i)
        // Pre-order: when a part and its first chapter share an href, the deeper entry wins.
        if (it.href) this.tocIdByHref.set(it.href, id)
        return { id, label: it.label?.trim() || 'Untitled', target: it.href || undefined, children: convert(it.subitems ?? [], id) }
      })
    const result = convert(toc, '')
    if (this.lastRelocate) this.emitRelocate(this.lastRelocate) // highlight the current chapter now
    return result
  }

  // ---------- text size (F03) and theme (F08) ----------

  async setView(view: ViewSettings): Promise<void> {
    if (!view.epub) return
    this.fontSize = clamp(view.epub.fontSize, FONT_SIZE.min, FONT_SIZE.max)
    this.fontFamily = view.epub.fontFamily
    this.applyStyles()
    this.emitView()
  }

  /** Re-reads the colour tokens (they change with the theme): book text and mark colours (F08.3). */
  setTheme(_theme: Theme): void {
    this.applyStyles()
    this.marks?.redrawAll()
  }

  zoomIn = () => this.setView({ epub: { fontSize: this.fontSize + FONT_SIZE.step, fontFamily: this.fontFamily } })
  zoomOut = () => this.setView({ epub: { fontSize: this.fontSize - FONT_SIZE.step, fontFamily: this.fontFamily } })

  private applyStyles(): void {
    this.view?.renderer?.setStyles(bookStyles(this.fontFamily, this.fontSize))
  }

  // ---------- events ----------

  private emitRelocate(detail: FoliateRelocateDetail): void {
    this.lastRelocate = detail
    const { fraction, location, cfi, tocItem } = detail
    const r = this.view?.renderer
    this.total = location?.total ?? 0
    const current = Math.min(this.total, (location?.current ?? 0) + 1)
    const ok = Number.isFinite(fraction) // NaN while foliate measures
    const progress: Progress = {
      loc: cfi,
      current,
      total: this.total,
      fraction: ok ? clamp(fraction, 0, 1) : 0,
      label: `Location ${current} of ${this.total} · ${ok ? Math.round(fraction * 100) : 0}%`,
      atStart: r?.atStart ?? false,
      atEnd: r?.atEnd ?? false,
      tocId: tocItem?.href ? this.tocIdByHref.get(tocItem.href) : undefined
    }
    this.events.emit('relocate', progress)
  }

  /**
   * Mouse wheel (B003, spec F02 "mouse wheel"): paginated text doesn't scroll, so the wheel turns
   * the page, like the PDF view at its edges. Ctrl+wheel changes the text size (spec shortcuts).
   * Wheel events inside a section's frame don't reach the app, so each section listens itself.
   */
  private onWheel = (e: WheelEvent) => {
    const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
    if (!delta) return
    e.preventDefault()
    if (e.ctrlKey) {
      void (delta < 0 ? this.zoomIn() : this.zoomOut())
      return
    }
    const now = performance.now()
    if (now - this.lastWheelFlip < WHEEL_FLIP_COOLDOWN) return
    this.lastWheelFlip = now
    void (delta > 0 ? this.next() : this.prev())
  }

  private onSectionLoad = (e: CustomEvent<{ doc: Document; index: number }>) => {
    forwardInput(e.detail.doc)
    e.detail.doc.addEventListener('wheel', this.onWheel, { passive: false })
    this.marks?.attach(e.detail.doc, e.detail.index)
  }

  private emitView(): void {
    this.events.emit('view', { kind: 'epub', fontSize: this.fontSize, fontFamily: this.fontFamily })
  }
}
