import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { TocItem } from '../ReaderAdapter'

interface OutlineNode {
  title: string
  dest: string | unknown[] | null
  items?: OutlineNode[]
}

export interface PdfToc {
  items: TocItem[]
  /** Entries with a page, in reading (pre-)order, for finding the current chapter. */
  pages: { id: string; page: number }[]
}

/** Converts the PDF outline (bookmarks) into TOC items that lead to `pdf:p=N` locations (F10). */
export async function buildPdfToc(doc: PDFDocumentProxy): Promise<PdfToc> {
  const outline = ((await doc.getOutline().catch(() => null)) ?? []) as OutlineNode[]
  const convert = (nodes: OutlineNode[], prefix: string): Promise<TocItem[]> =>
    Promise.all(
      nodes.map(async (node, i) => {
        const id = prefix ? `${prefix}.${i}` : String(i)
        const page = await destToPage(doc, node.dest)
        return {
          id,
          label: node.title?.trim() || 'Untitled',
          target: page ? `pdf:p=${page}` : undefined,
          children: await convert(node.items ?? [], id)
        }
      })
    )
  const items = await convert(outline, '')

  const pages: PdfToc['pages'] = []
  const walk = (list: TocItem[]) =>
    list.forEach((t) => {
      const m = t.target ? /^pdf:p=(\d+)$/.exec(t.target) : null
      if (m) pages.push({ id: t.id, page: Number(m[1]) })
      walk(t.children)
    })
  walk(items)
  return { items, pages }
}

/** The deepest TOC entry that starts on or before `page`. */
export function currentTocId(pages: PdfToc['pages'], page: number): string | undefined {
  let id: string | undefined
  for (const t of pages) if (t.page <= page) id = t.id
  return id
}

/** Outline destinations are named (string) or explicit ([pageRef, fit, …]); both lead to a page. */
async function destToPage(doc: PDFDocumentProxy, dest: string | unknown[] | null): Promise<number | null> {
  if (!dest) return null
  try {
    const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest
    const ref = explicit?.[0]
    if (typeof ref === 'number') return ref + 1 // some PDFs use a page index directly
    if (ref && typeof ref === 'object') return (await doc.getPageIndex(ref as { num: number; gen: number })) + 1
  } catch {
    // A broken destination just becomes a non-clickable entry.
  }
  return null
}
