import type { FoliateView } from 'foliate-js/view.js'
import { Overlayer } from 'foliate-js/overlayer.js'
import type { Emitter, ReaderEvents, RenderHighlight, SearchHit } from '../ReaderAdapter'

interface MarkAnnotation {
  value: string // CFI (range)
  kind: 'search' | 'highlight'
  color?: RenderHighlight['color']
  note?: string
  [key: string]: unknown
}

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number }
const SVG = 'http://www.w3.org/2000/svg'

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/** A rectangle inside a section iframe, in app-window coordinates (for placing popups). */
function toWindowRect(range: Range): DOMRect {
  const r = range.getBoundingClientRect()
  const frame = range.startContainer.ownerDocument?.defaultView?.frameElement?.getBoundingClientRect()
  return new DOMRect(r.x + (frame?.x ?? 0), r.y + (frame?.y ?? 0), r.width, r.height)
}

/**
 * Everything drawn over EPUB text and the reader's text selection (S8, S9), through foliate's
 * annotation overlay: the search outline, highlights, selecting text and clicking highlights.
 * foliate rebuilds a section's overlay whenever the section is (re)loaded or re-laid out.
 */
export class EpubMarks {
  private searchMark: string | null = null
  private highlights: RenderHighlight[] = []
  private drawn = new Set<string>()
  /** Where each noted highlight was last drawn, in its section's coordinates (for the tooltip). */
  private noteRects = new Map<string, { note: string; rects: Rect[] }>()

  constructor(
    private readonly view: FoliateView,
    private readonly events: Emitter<ReaderEvents>
  ) {
    view.addEventListener('draw-annotation', this.onDraw as EventListener)
    view.addEventListener('show-annotation', this.onShow as EventListener)
    view.addEventListener('create-overlay', () => this.redrawAll())
  }

  /** Listens for selections in a newly loaded section document. */
  attach(doc: Document, index: number): void {
    doc.addEventListener('pointerdown', () => this.events.emit('select', null))
    // Hovering a highlight with a note shows the note as a tooltip (F12).
    doc.addEventListener('pointermove', (e) => {
      const hit = [...this.noteRects.values()].find(({ rects }) =>
        rects.some((r) => e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)
      )
      if (hit) doc.documentElement.title = hit.note
      else doc.documentElement.removeAttribute('title')
    })
    doc.addEventListener('pointerup', () =>
      setTimeout(() => {
        const sel = doc.getSelection()
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
        const range = sel.getRangeAt(0)
        const text = range.toString()
        if (!text.trim()) return
        this.events.emit('select', {
          anchor: { kind: 'epub', cfi: this.view.getCFI(index, range) },
          text,
          rect: toWindowRect(range)
        })
      }, 0)
    )
  }

  setSearch(hit: SearchHit | null): void {
    if (this.ready && this.searchMark) void this.view.deleteAnnotation({ value: this.searchMark })
    this.searchMark = hit?.anchor.kind === 'epub' ? hit.anchor.cfi : null
    this.addSearch()
  }

  setHighlights(list: RenderHighlight[]): void {
    const keep = new Set(list.flatMap((h) => (h.anchor.kind === 'epub' ? [h.anchor.cfi] : [])))
    if (this.ready) for (const cfi of this.drawn) if (!keep.has(cfi)) void this.view.deleteAnnotation({ value: cfi })
    this.highlights = list
    this.addHighlights()
  }

  /** Re-adds every mark: after a section reload and after a theme change (new colours). */
  redrawAll(): void {
    this.addHighlights()
    this.addSearch()
  }

  clearSelection(): void {
    if (!this.ready) return
    for (const { doc } of this.view.renderer.getContents()) doc?.getSelection()?.removeAllRanges()
  }

  /** foliate's renderer exists only after view.open(); before that there is nothing to draw on. */
  private get ready(): boolean {
    return !!this.view.renderer
  }

  private addHighlights(): void {
    if (!this.ready) return
    this.drawn.clear()
    this.noteRects.clear()
    for (const h of this.highlights) {
      if (h.anchor.kind !== 'epub') continue
      this.drawn.add(h.anchor.cfi)
      // addAnnotation replaces an existing mark with the same CFI (e.g. a colour change).
      void this.view.addAnnotation({ value: h.anchor.cfi, kind: 'highlight', color: h.color, note: h.note } satisfies MarkAnnotation)
    }
  }

  private addSearch(): void {
    if (this.ready && this.searchMark) void this.view.addAnnotation({ value: this.searchMark, kind: 'search' } satisfies MarkAnnotation)
  }

  /** foliate asks how to draw each annotation. */
  private onDraw = (e: CustomEvent<{ draw: (f: unknown, o?: object) => void; annotation: MarkAnnotation }>) => {
    const { annotation, draw } = e.detail
    if (annotation.kind === 'search') draw(Overlayer.outline, { color: token('--accent'), width: 2, padding: 2, radius: 3 })
    else if (annotation.kind === 'highlight') draw((rects: Rect[]) => this.drawHighlight(annotation, rects), {})
  }

  /** The marker colour, plus a ✎ after the last line when the highlight has a note (F12). */
  private drawHighlight(annotation: MarkAnnotation, rects: Rect[]): SVGElement {
    const fill = Overlayer.highlight(rects as unknown as DOMRect[], { color: token(`--hl-${annotation.color}`) })
    const last = rects[rects.length - 1]
    if (!annotation.note || !last) {
      this.noteRects.delete(annotation.value)
      return fill
    }
    this.noteRects.set(annotation.value, { note: annotation.note, rects })
    const group = document.createElementNS(SVG, 'g')
    const pen = document.createElementNS(SVG, 'text')
    pen.textContent = '✎'
    // Small and raised like a footnote mark, so it doesn't cover the next word on the line.
    pen.setAttribute('x', String(last.right))
    pen.setAttribute('y', String(last.top + last.height * 0.4))
    pen.setAttribute('font-size', String(Math.max(9, Math.round(last.height * 0.5))))
    pen.setAttribute('fill', token('--accent'))
    group.append(fill, pen)
    return group
  }

  /** A click on a mark (foliate hit-tests its overlay). */
  private onShow = (e: CustomEvent<{ value: string; range: Range }>) => {
    const h = this.highlights.find((x) => x.anchor.kind === 'epub' && x.anchor.cfi === e.detail.value)
    if (h) this.events.emit('highlight-click', { id: h.id, rect: toWindowRect(e.detail.range) })
  }
}
