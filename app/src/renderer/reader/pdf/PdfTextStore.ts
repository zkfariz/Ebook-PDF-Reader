import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api'
import type { OcrLine } from '@shared/schemas'
import type { PageTextState, SearchHit } from '../ReaderAdapter'
import { buildOcrContent } from '../ocr/ocrContent'
import { buildPageText, findMatches, prepareQuery, snippet, type PageText } from './pageText'

export interface PdfPageContent {
  /** As pdf.js returns it (the text layer renders from this). */
  content: TextContent
  /** Text items only, in the same order as the text layer's spans. */
  items: TextItem[]
  text: PageText
  /** Where the text comes from: the PDF itself, or text recognised from the page picture (F16). */
  source: 'pdf' | 'ocr'
}

const BATCH_PAGES = 10 // yield results at least every 10 pages, so the list fills in steadily

/** Extracted text of every page, cached; used by search (S8) and highlights (S9). */
export class PdfTextStore {
  private cache = new Map<number, Promise<PdfPageContent>>()
  /** Recognised pages (F16): page number → lines. An empty list = recognised, nothing readable on it. */
  private ocrPages = new Map<number, readonly OcrLine[]>()

  constructor(private readonly doc: PDFDocumentProxy) {}

  get(pageNumber: number): Promise<PdfPageContent> {
    let entry = this.cache.get(pageNumber)
    if (!entry) {
      entry = this.doc.getPage(pageNumber).then(async (page): Promise<PdfPageContent> => {
        const content = await page.getTextContent()
        const items = content.items.filter((i): i is TextItem => 'str' in i)
        const text = buildPageText(items)
        // A page with no text of its own, but with recognised lines, uses those (F16).
        const recognised = this.ocrPages.get(pageNumber)
        if (!text.text.trim() && recognised && recognised.length > 0) {
          const ocr = buildOcrContent(recognised, page.view as [number, number, number, number])
          const ocrItems = ocr.items.filter((i): i is TextItem => 'str' in i)
          return { content: ocr, items: ocrItems, text: buildPageText(ocrItems), source: 'ocr' }
        }
        return { content, items, text, source: 'pdf' }
      })
      this.cache.set(pageNumber, entry)
    }
    return entry
  }

  /** Loads recognised pages saved earlier (call before the first page is shown). */
  setOcr(pages: Record<string, { lines: OcrLine[] }>): void {
    for (const [page, { lines }] of Object.entries(pages)) this.ocrPages.set(Number(page), lines)
    this.cache.clear()
  }

  /** A page was just recognised: later reads (text layer, search, highlights) use its text. */
  addOcrPage(pageNumber: number, lines: readonly OcrLine[]): void {
    this.ocrPages.set(pageNumber, lines)
    this.cache.delete(pageNumber)
  }

  /** Has this page text of its own, was it recognised, or is it only a picture? (F16.1) */
  async pageState(pageNumber: number): Promise<PageTextState> {
    const { text, source } = await this.get(pageNumber)
    if (source === 'ocr') return 'recognised'
    if (text.text.trim()) return 'text'
    return this.ocrPages.has(pageNumber) ? 'blank' : 'picture'
  }

  /** Whole-book search in page order (F09); batches of results; abortable. */
  async *search(query: string, signal: AbortSignal): AsyncIterable<SearchHit[]> {
    const prepared = prepareQuery(query)
    if (!prepared) return
    let batch: SearchHit[] = []
    for (let n = 1; n <= this.doc.numPages; n++) {
      if (signal.aborted) return
      const { text } = await this.get(n)
      for (const { start, end } of findMatches(text.text, prepared)) {
        batch.push({
          id: `p${n}:${start}`,
          loc: `pdf:p=${n}`,
          anchor: { kind: 'pdf', page: n, start, end },
          ...snippet(text.text, start, end),
          label: `p. ${n}`
        })
      }
      if (batch.length > 0 && (n % BATCH_PAGES === 0 || batch.length >= 50)) {
        yield batch
        batch = []
      }
    }
    if (batch.length > 0 && !signal.aborted) yield batch
  }

  /** False if no page has any text, i.e. the PDF is scanned images (F09.4). */
  async hasText(): Promise<boolean> {
    for (let n = 1; n <= this.doc.numPages; n++) {
      if ((await this.get(n)).text.text.trim()) return true
    }
    return false
  }
}
