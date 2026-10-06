import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { Theme } from '@shared/ipc'
import {
  Emitter,
  ReaderError,
  type BookMeta,
  type Loc,
  type PdfZoom,
  type ReaderAdapter,
  type ReaderEvents,
  type RenderHighlight,
  type SearchHit,
  type TocItem,
  type ViewSettings
} from '../ReaderAdapter'
import type { Anchor } from '@shared/schemas'
import { PdfTextStore } from './PdfTextStore'
import { PageLayers } from './PageLayers'
import { PdfMarks } from './PdfMarks'
import { PageCanvases } from './PageCanvases'
import { nextZoomStep, scaleToPercent, viewportScale } from './zoom'
import { buildPdfToc, currentTocId, type PdfToc } from './pdfToc'
import './pdf.css'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

// pdf.js runtime assets are copied into public/pdfjs by scripts/copy-pdfjs-assets.mjs.
const asset = (dir: string) => new URL(`pdfjs/${dir}/`, document.baseURI).href

const PAGE_MARGIN = 16 // px around the page inside the reading pane (matches .pdf-page padding)
const WHEEL_FLIP_COOLDOWN = 300 // ms: one wheel "flick" must not skip several pages

type ScrollTo = 'top' | 'bottom' | 'keep'

export class PdfAdapter implements ReaderAdapter {
  readonly format = 'pdf' as const
  private loadingTask?: PDFDocumentLoadingTask
  private doc?: PDFDocumentProxy
  private pane?: HTMLElement
  private pageEl = Object.assign(document.createElement('div'), { className: 'pdf-page' })
  private pageNumber = 1
  private zoom: PdfZoom = 'fit-page'
  private currentScale = 1
  private token = 0
  private canvases = new PageCanvases()
  private resizeObserver?: ResizeObserver
  private lastWheelFlip = 0
  private events = new Emitter<ReaderEvents>()
  private readonly marks: PdfMarks
  private destroyed = false
  private onFirstShown?: () => void
  private toc?: PdfToc
  private textStore?: PdfTextStore
  private layers = new PageLayers()

  on = this.events.on.bind(this.events)

  constructor() {
    this.marks = new PdfMarks(this.layers, this.events) // after the fields it uses exist
  }

  async open(data: Uint8Array, opts?: { password?: string }): Promise<BookMeta> {
    try {
      // pdf.js takes ownership of (detaches) the buffer it gets, so give it a copy:
      // the caller may need the original again (e.g. retry with a password).
      this.loadingTask = pdfjs.getDocument({
        data: data.slice(),
        password: opts?.password,
        cMapUrl: asset('cmaps'),
        cMapPacked: true,
        standardFontDataUrl: asset('standard_fonts'),
        iccUrl: asset('iccs'),
        wasmUrl: asset('wasm'),
        verbosity: pdfjs.VerbosityLevel.ERRORS
      })
      this.doc = await this.loadingTask.promise
      this.textStore = new PdfTextStore(this.doc)
    } catch (err) {
      throw toReaderError(err)
    }

    const meta = await this.doc.getMetadata().catch(() => null)
    const info = (meta?.info ?? {}) as { Title?: unknown; Author?: unknown }
    return { title: cleanString(info.Title), author: cleanString(info.Author) }
  }

  mount(pane: HTMLElement, startAt?: Loc): Promise<void> {
    const shown = new Promise<void>((resolve) => (this.onFirstShown = resolve))
    const start = startAt ? parsePdfLoc(startAt) : null
    if (start && this.doc && start <= this.doc.numPages) this.pageNumber = start
    this.pane = pane
    pane.classList.add('pdf-pane')
    this.pageEl.replaceChildren(this.layers.sheet)
    pane.append(this.pageEl)
    pane.addEventListener('wheel', this.onWheel, { passive: false })
    // Fires once immediately → first render; then on every window/pane resize.
    this.resizeObserver = new ResizeObserver(() => void this.show(this.pageNumber, 'keep'))
    this.resizeObserver.observe(pane)
    return shown
  }

  destroy(): void {
    this.destroyed = true
    this.onFirstShown?.()
    this.resizeObserver?.disconnect()
    this.pane?.removeEventListener('wheel', this.onWheel)
    this.pane?.classList.remove('pdf-pane')
    this.canvases.cancelAll()
    this.layers.cancel()
    this.pageEl.remove()
    this.events.clear()
    void this.loadingTask?.destroy() // also terminates the worker
  }

  // ---------- navigation (F02) ----------

  async goTo(loc: Loc): Promise<void> {
    const n = parsePdfLoc(loc)
    if (n) await this.goToNumber(n)
  }

  async goToNumber(n: number): Promise<void> {
    if (!this.doc || !Number.isInteger(n) || n < 1 || n > this.doc.numPages) return
    await this.show(n, 'top')
  }

  next = () => this.step(1, 'top')
  prev = () => this.step(-1, 'top')
  first = () => this.goToNumber(1)
  last = () => this.goToNumber(this.doc?.numPages ?? 1)

  // ---------- search (F09) ----------

  search(query: string, signal: AbortSignal): AsyncIterable<SearchHit[]> {
    return this.textStore ? this.textStore.search(query, signal) : (async function* () {})()
  }

  async hasText(): Promise<boolean> {
    return this.textStore ? this.textStore.hasText() : false
  }

  showSearchMatch(hit: SearchHit | null): void {
    this.marks.setSearch(hit)
  }

  // ---------- highlights (F11) ----------

  setHighlights(highlights: RenderHighlight[]): void {
    this.marks.setHighlights(highlights)
  }

  clearSelection(): void {
    this.marks.clearSelection()
  }

  describe(anchor: Anchor): string {
    return anchor.kind === 'pdf' ? `p. ${anchor.page}` : ''
  }

  // ---------- locations for bookmarks (F06) ----------

  bookmarkLoc(): Loc | null {
    return this.doc ? `pdf:p=${this.pageNumber}` : null
  }

  containsLoc(loc: Loc): boolean {
    return parsePdfLoc(loc) === this.pageNumber
  }

  compareLocs(a: Loc, b: Loc): number {
    return (parsePdfLoc(a) ?? 0) - (parsePdfLoc(b) ?? 0)
  }

  // ---------- table of contents (F10) ----------

  async getToc(): Promise<TocItem[]> {
    if (!this.doc) return []
    if (!this.toc) {
      this.toc = await buildPdfToc(this.doc)
      if (this.pane) this.emitState() // so the current chapter is highlighted straight away
    }
    return this.toc.items
  }

  isAtEdge(edge: 'top' | 'bottom'): boolean {
    const p = this.pane
    if (!p) return true
    return edge === 'top' ? p.scrollTop <= 1 : p.scrollTop + p.clientHeight >= p.scrollHeight - 1
  }

  private async step(delta: 1 | -1, scrollTo: ScrollTo): Promise<void> {
    if (!this.doc) return
    const n = this.pageNumber + delta
    if (n < 1 || n > this.doc.numPages) return // no wrap-around (F02.2)
    await this.show(n, scrollTo)
  }

  // ---------- zoom (F03) ----------

  async setView(view: ViewSettings): Promise<void> {
    if (!view.pdf) return
    this.zoom = view.pdf.zoom
    await this.show(this.pageNumber, 'keep')
  }

  /** Night mode inverts the page image only (design system); later overlays stay un-inverted. */
  setTheme(theme: Theme): void {
    this.pageEl.classList.toggle('night', theme === 'night')
  }

  zoomIn = () => this.setView({ pdf: { zoom: nextZoomStep(scaleToPercent(this.currentScale) / 100, 1) } })
  zoomOut = () => this.setView({ pdf: { zoom: nextZoomStep(scaleToPercent(this.currentScale) / 100, -1) } })

  private onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault()
      void (e.deltaY < 0 ? this.zoomIn() : this.zoomOut())
      return
    }
    // At the bottom/top edge, one more scroll turns the page (F02.5).
    const down = e.deltaY > 0
    if (!this.isAtEdge(down ? 'bottom' : 'top')) return
    e.preventDefault()
    const now = performance.now()
    if (now - this.lastWheelFlip < WHEEL_FLIP_COOLDOWN) return
    this.lastWheelFlip = now
    void this.step(down ? 1 : -1, down ? 'top' : 'bottom')
  }

  // ---------- rendering ----------

  /** Shows page n at the current zoom. Draws off-screen and swaps in one step (no half-drawn page). */
  private async show(n: number, scrollTo: ScrollTo): Promise<void> {
    const { doc, pane } = this
    if (!doc || !pane || this.destroyed) return
    const token = ++this.token
    const pageChanged = n !== this.pageNumber
    this.pageNumber = n
    this.canvases.cancelCurrent()

    const canvas = await this.canvasFor(n, token, true)
    if (!canvas || token !== this.token || this.destroyed) return

    // Remember the visual centre so zooming/resizing keeps the same spot in view.
    const ratioY = (pane.scrollTop + pane.clientHeight / 2) / Math.max(1, pane.scrollHeight)
    const ratioX = (pane.scrollLeft + pane.clientWidth / 2) / Math.max(1, pane.scrollWidth)
    // The canvas appears at once; the text layer (positions for marks and selection) follows.
    void this.layers
      .show(canvas, await doc.getPage(n), n, this.currentScale, this.textStore!.get(n))
      .then((ready) => ready && this.marks.redraw())
    if (scrollTo === 'keep' && !pageChanged) {
      pane.scrollTop = ratioY * pane.scrollHeight - pane.clientHeight / 2
      pane.scrollLeft = ratioX * pane.scrollWidth - pane.clientWidth / 2
    } else {
      pane.scrollTop = scrollTo === 'bottom' ? pane.scrollHeight : 0
      pane.scrollLeft = (pane.scrollWidth - pane.clientWidth) / 2
    }

    this.emitState()
    this.onFirstShown?.()
    this.onFirstShown = undefined
    this.canvases.keepAround(n, (far) => void this.doc?.getPage(far).then((p) => p.cleanup()))
    void this.prerenderNeighbours(token)
  }

  /** Canvas for page n at the current zoom (see PageCanvases); null if superseded or cancelled. */
  private async canvasFor(n: number, token: number, isCurrent: boolean): Promise<HTMLCanvasElement | null> {
    const { doc, pane } = this
    if (!doc || !pane) return null
    const page = await doc.getPage(n)
    if (token !== this.token) return null
    const base = page.getViewport({ scale: 1 })
    const availW = pane.clientWidth - 2 * PAGE_MARGIN
    const availH = pane.clientHeight - 2 * PAGE_MARGIN
    if (availW <= 0 || availH <= 0) return null
    const scale = viewportScale(this.zoom, base.width, base.height, availW, availH)
    if (isCurrent) this.currentScale = scale
    const canvas = await this.canvases.draw(page, n, scale, isCurrent)
    return this.destroyed ? null : canvas
  }

  private async prerenderNeighbours(token: number): Promise<void> {
    const total = this.doc?.numPages ?? 0
    for (const n of [this.pageNumber + 1, this.pageNumber - 1]) {
      if (token !== this.token || this.destroyed) return
      if (n >= 1 && n <= total) await this.canvasFor(n, token, false).catch(() => null)
    }
  }

  private emitState(): void {
    const total = this.doc?.numPages ?? 1
    const current = this.pageNumber
    this.events.emit('relocate', {
      loc: `pdf:p=${current}`,
      current,
      total,
      fraction: total > 1 ? (current - 1) / (total - 1) : 1,
      label: `${current} / ${total}`,
      atStart: current === 1,
      atEnd: current === total,
      tocId: this.toc ? currentTocId(this.toc.pages, current) : undefined
    })
    this.events.emit('view', { kind: 'pdf', zoom: this.zoom, percent: scaleToPercent(this.currentScale) })
  }
}

/** "pdf:p=12" → 12 (data-model.md §3). */
function parsePdfLoc(loc: Loc): number | null {
  const m = /^pdf:p=(\d+)$/.exec(loc)
  return m ? Number(m[1]) : null
}

function toReaderError(err: unknown): ReaderError {
  if (err instanceof pdfjs.PasswordException) {
    return new ReaderError(err.code === pdfjs.PasswordResponses.INCORRECT_PASSWORD ? 'wrong-password' : 'password-required')
  }
  return new ReaderError('damaged', err instanceof Error ? err.message : String(err))
}

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
