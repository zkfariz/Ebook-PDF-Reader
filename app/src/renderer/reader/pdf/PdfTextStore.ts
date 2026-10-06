import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api'
import type { SearchHit } from '../ReaderAdapter'
import { buildPageText, findMatches, prepareQuery, snippet, type PageText } from './pageText'

export interface PdfPageContent {
  /** As pdf.js returns it (the text layer renders from this). */
  content: TextContent
  /** Text items only, in the same order as the text layer's spans. */
  items: TextItem[]
  text: PageText
}

const BATCH_PAGES = 10 // yield results at least every 10 pages, so the list fills in steadily

/** Extracted text of every page, cached; used by search (S8) and highlights (S9). */
export class PdfTextStore {
  private cache = new Map<number, Promise<PdfPageContent>>()

  constructor(private readonly doc: PDFDocumentProxy) {}

  get(pageNumber: number): Promise<PdfPageContent> {
    let entry = this.cache.get(pageNumber)
    if (!entry) {
      entry = this.doc
        .getPage(pageNumber)
        .then((page) => page.getTextContent())
        .then((content) => {
          const items = content.items.filter((i): i is TextItem => 'str' in i)
          return { content, items, text: buildPageText(items) }
        })
      this.cache.set(pageNumber, entry)
    }
    return entry
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
