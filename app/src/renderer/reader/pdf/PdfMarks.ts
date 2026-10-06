import type { Anchor } from '@shared/schemas'
import type { Emitter, ReaderEvents, RenderHighlight, SearchHit } from '../ReaderAdapter'
import { resolvePdfOffsets } from './anchors'
import type { PageLayers } from './PageLayers'

type PdfAnchor = Extract<Anchor, { kind: 'pdf' }>
const ONE_PAGE = 'Select text on one page at a time'

/**
 * Everything drawn on top of a PDF page and the reader's text selection (S8, S9):
 * the search outline, highlights, selecting text and clicking highlights.
 */
export class PdfMarks {
  private searchMark: PdfAnchor | null = null
  private highlights: RenderHighlight[] = []
  private repaired = new Set<string>() // ids already reported, to avoid repeat events

  constructor(
    private readonly layers: PageLayers,
    private readonly events: Emitter<ReaderEvents>
  ) {
    const sheet = layers.sheet
    sheet.addEventListener('pointerdown', () => this.events.emit('select', null))
    sheet.addEventListener('pointerup', (e) => setTimeout(() => this.onPointerUp(e), 0))
    sheet.addEventListener('pointermove', (e) => this.showNoteTooltip(e))
  }

  setSearch(hit: SearchHit | null): void {
    this.searchMark = hit?.anchor.kind === 'pdf' ? hit.anchor : null
    this.redraw()
  }

  setHighlights(list: RenderHighlight[]): void {
    this.highlights = list
    this.redraw()
  }

  clearSelection(): void {
    window.getSelection()?.removeAllRanges()
  }

  /** (Re)draws everything for the page on screen; runs after every text-layer render. */
  redraw(): void {
    const { layers } = this
    layers.clear('hl-mark')
    layers.clear('note-marker')
    layers.clear('search-mark')
    const page = layers.page
    const text = layers.content?.text.text
    if (!page || text === undefined) return

    for (const h of this.highlights) {
      if (h.anchor.kind !== 'pdf' || h.anchor.page !== page) continue
      const at = resolvePdfOffsets(text, h.anchor.start, h.anchor.end, h.text)
      if (!at) {
        this.reportOnce(h.id, () => this.events.emit('highlight-missing', { id: h.id }))
        continue
      }
      if (at.start !== h.anchor.start || at.end !== h.anchor.end) {
        const anchor: PdfAnchor = { ...h.anchor, start: at.start, end: at.end }
        this.reportOnce(h.id, () => this.events.emit('highlight-repaired', { id: h.id, anchor }))
      }
      const boxes = layers.mark(at.start, at.end, `hl-mark hl-${h.color}`)
      for (const box of boxes) {
        box.dataset['id'] = h.id
        box.classList.toggle('has-note', h.hasNote)
        if (h.note) box.dataset['note'] = h.note
      }
      const last = boxes[boxes.length - 1]
      if (h.note && last) {
        // F12: a small ✎ right after the highlighted text says "this one has a note".
        const marker = Object.assign(document.createElement('div'), { className: 'note-marker', textContent: '✎' })
        marker.style.left = `${last.offsetLeft + last.offsetWidth}px`
        // Small and raised like a footnote mark, so it doesn't cover the next word on the line.
        marker.style.top = `${last.offsetTop - last.offsetHeight * 0.2}px`
        marker.style.fontSize = `${Math.max(9, Math.round(last.offsetHeight * 0.5))}px`
        last.after(marker)
      }
    }

    const m = this.searchMark
    if (m && m.page === page) layers.mark(m.start, m.end, 'search-mark')[0]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  /**
   * Hovering a highlight that has a note shows the note as a tooltip (F12). The marks layer
   * ignores the mouse (the text layer above must stay selectable), so hit-test by position and
   * put the note in the page's title.
   */
  private showNoteTooltip(e: PointerEvent): void {
    const hit = [...this.layers.sheet.querySelectorAll<HTMLElement>('.hl-mark[data-note]')].find((el) => {
      const r = el.getBoundingClientRect()
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    })
    const note = hit?.dataset['note']
    if (note) this.layers.sheet.title = note
    else this.layers.sheet.removeAttribute('title')
  }

  private reportOnce(id: string, report: () => void): void {
    if (this.repaired.has(id)) return
    this.repaired.add(id)
    report()
  }

  private onPointerUp(e: PointerEvent): void {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      // A plain click: did it land on a highlight? (The marks layer itself ignores the mouse.)
      const hit = [...this.layers.sheet.querySelectorAll<HTMLElement>('.hl-mark')].find((el) => {
        const r = el.getBoundingClientRect()
        return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      })
      if (hit?.dataset['id']) this.events.emit('highlight-click', { id: hit.dataset['id'], rect: hit.getBoundingClientRect() })
      return
    }
    const range = sel.getRangeAt(0)
    const start = this.layers.offsetOf(range.startContainer, range.startOffset)
    const end = this.layers.offsetOf(range.endContainer, range.endOffset)
    const text = this.layers.content?.text.text
    if (start === null || end === null || text === undefined) {
      this.events.emit('select-error', { message: ONE_PAGE, rect: range.getBoundingClientRect() })
      return
    }
    const quote = text.slice(start, end)
    if (end <= start || !quote.trim()) return
    this.events.emit('select', {
      anchor: { kind: 'pdf', page: this.layers.page, start, end },
      text: quote,
      rect: range.getBoundingClientRect()
    })
  }
}
