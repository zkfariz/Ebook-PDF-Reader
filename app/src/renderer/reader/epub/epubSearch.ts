import type { FoliateTocItem, FoliateView } from 'foliate-js/view.js'
import type { SearchHit } from '../ReaderAdapter'

/**
 * Whole-book EPUB search (F09) with foliate's matcher (case- and accent-insensitive, via
 * Intl.Collator). foliate's own view.search() would outline *every* match in red; this calls
 * the same building blocks so only the result the reader picks is outlined.
 */
export async function* searchEpub(view: FoliateView, query: string, signal: AbortSignal): AsyncIterable<SearchHit[]> {
  const [{ searchMatcher }, { textWalker }] = await Promise.all([
    import('foliate-js/search.js'),
    import('foliate-js/text-walker.js')
  ])
  const matcher = searchMatcher(textWalker, { matchCase: false, matchDiacritics: false, matchWholeWords: false })
  const labels = sectionLabels(view)
  const sections = view.book.sections
  for (const [index, section] of sections.entries()) {
    if (signal.aborted) return
    if (!section.createDocument) continue
    const doc = await section.createDocument()
    if (signal.aborted) return
    const hits: SearchHit[] = []
    for (const { range, excerpt } of matcher(doc, query)) {
      const cfi = view.getCFI(index, range)
      hits.push({
        id: cfi,
        loc: cfi,
        anchor: { kind: 'epub', cfi },
        pre: excerpt.pre,
        match: excerpt.match,
        post: excerpt.post,
        label: labels[index] ?? `Section ${index + 1}`
      })
    }
    if (hits.length) yield hits
  }
}

/** Chapter title for every spine section (sections without their own TOC entry inherit the previous one). */
export function sectionLabels(view: FoliateView): (string | undefined)[] {
  const byIndex = new Map<number, string>()
  const walk = (items: FoliateTocItem[]) =>
    items.forEach((item) => {
      try {
        const index = item.href ? view.book.resolveHref(item.href)?.index : undefined
        // Pre-order: a chapter inside a part overwrites the part's label for the same file.
        if (index !== undefined && item.label?.trim()) byIndex.set(index, item.label.trim())
      } catch {
        // an unresolvable href just gives no label
      }
      walk(item.subitems ?? [])
    })
  walk(view.book.toc ?? [])
  const labels: (string | undefined)[] = []
  let last: string | undefined
  view.book.sections.forEach((_, i) => {
    last = byIndex.get(i) ?? last
    labels.push(last)
  })
  return labels
}
