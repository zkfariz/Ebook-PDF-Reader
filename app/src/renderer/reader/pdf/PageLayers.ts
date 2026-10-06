import { TextLayer, type PDFPageProxy } from 'pdfjs-dist'
import { locateOffset } from './pageText'
import type { PdfPageContent } from './PdfTextStore'

/**
 * The visible PDF page: canvas (the picture), a marks layer (search outline now, highlights in
 * S9) and pdf.js's transparent text layer on top (for text positions and selection).
 * Night mode inverts only the canvas, so marks keep their real colours.
 */
export class PageLayers {
  readonly sheet = Object.assign(document.createElement('div'), { className: 'pdf-sheet' })
  private marks = Object.assign(document.createElement('div'), { className: 'pdf-marks' })
  private textLayer?: TextLayer
  private textDiv?: HTMLDivElement
  /** Text of the page on screen (set once its text layer is ready). */
  content?: PdfPageContent
  /** Page number whose text layer is ready (0 = none). */
  page = 0

  /** Puts a freshly drawn canvas on screen right away, then builds the text layer for it. */
  async show(canvas: HTMLCanvasElement, page: PDFPageProxy, pageNumber: number, scale: number, content: Promise<PdfPageContent>): Promise<boolean> {
    this.textLayer?.cancel()
    this.page = 0
    this.marks.replaceChildren()
    const textDiv = Object.assign(document.createElement('div'), { className: 'textLayer' })
    this.textDiv = textDiv
    this.sheet.replaceChildren(canvas, this.marks, textDiv)
    this.sheet.style.setProperty('--total-scale-factor', String(scale))

    this.content = await content
    const layer = new TextLayer({
      textContentSource: this.content.content,
      container: textDiv,
      viewport: page.getViewport({ scale })
    })
    this.textLayer = layer
    try {
      await layer.render()
    } catch {
      return false // cancelled because another page/zoom took over
    }
    if (this.textLayer !== layer) return false
    this.page = pageNumber
    return true
  }

  /** DOM range over page-text offsets [start, end), or null if the text layer is not ready. */
  range(start: number, end: number): Range | null {
    const layer = this.textLayer
    const content = this.content
    if (!layer || !content || !this.page) return null
    const a = locateOffset(content.text, content.items, start)
    const b = locateOffset(content.text, content.items, Math.max(start, end - 1))
    const startNode = layer.textDivs[a.item]?.firstChild
    const endNode = layer.textDivs[b.item]?.firstChild
    if (!startNode || !endNode) return null
    const range = document.createRange()
    range.setStart(startNode, a.offset)
    range.setEnd(endNode, Math.min(b.offset + 1, endNode.textContent?.length ?? 0))
    return range
  }

  /**
   * Page-text offset of a DOM point (a selection boundary), or null if the point is not in
   * this page's text layer (e.g. a selection that runs into the sidebar).
   */
  offsetOf(node: Node, offset: number): number | null {
    const layer = this.textLayer
    const content = this.content
    const root = this.textDiv
    if (!layer || !content || !root || !this.page || !root.contains(node)) return null
    const spans = layer.textDivs
    const spanStart = (span: Element | null | undefined) => {
      const i = span ? spans.indexOf(span as HTMLElement) : -1
      return i >= 0 ? content.text.starts[i]! : null
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const start = spanStart(node.parentElement?.closest('span'))
      return start === null ? null : start + offset
    }
    // An element boundary: "before child #offset" of a span or of the layer itself.
    const el = node as Element
    if (el !== root) {
      const start = spanStart(el.closest('span'))
      return start === null ? null : start + (offset > 0 ? (el.textContent?.length ?? 0) : 0)
    }
    const child = el.childNodes[offset] as Element | undefined
    return child ? spanStart(child.closest?.('span') ?? child) : content.text.text.length
  }

  /** Draws boxes over [start, end) with a CSS class; returns them (e.g. to scroll into view). */
  mark(start: number, end: number, className: string): HTMLElement[] {
    const range = this.range(start, end)
    if (!range) return []
    const origin = this.sheet.getBoundingClientRect()
    return [...range.getClientRects()]
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => {
        const box = Object.assign(document.createElement('div'), { className })
        box.style.left = `${r.left - origin.left}px`
        box.style.top = `${r.top - origin.top}px`
        box.style.width = `${r.width}px`
        box.style.height = `${r.height}px`
        this.marks.append(box)
        return box
      })
  }

  clear(className: string): void {
    this.marks.querySelectorAll(`.${className}`).forEach((el) => el.remove())
  }

  cancel(): void {
    this.textLayer?.cancel()
  }
}
