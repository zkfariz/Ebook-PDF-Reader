// The text of one PDF page, as pdf.js extracts it (architecture §5 "Page text model").
// Shared by search (S8) and highlights (S9). Pure functions, unit-tested.

export interface TextItemLike {
  str: string
  hasEOL?: boolean
}

export interface PageText {
  /** All items joined; an item that ends a line is followed by "\n". */
  text: string
  /** starts[i] = offset of item i in `text` (items = text items only, same order as the text layer spans). */
  starts: number[]
}

export function buildPageText(items: TextItemLike[]): PageText {
  let text = ''
  const starts: number[] = []
  for (const item of items) {
    starts.push(text.length)
    text += item.str + (item.hasEOL ? '\n' : '')
  }
  return { text, starts }
}

/** Which item holds offset `pos`, and where inside it (clamped to the item's own characters). */
export function locateOffset(pt: PageText, items: TextItemLike[], pos: number): { item: number; offset: number } {
  let i = 0
  while (i + 1 < pt.starts.length && pt.starts[i + 1]! <= pos) i++
  const len = items[i]?.str.length ?? 0
  return { item: i, offset: Math.max(0, Math.min(len, pos - (pt.starts[i] ?? 0))) }
}

/**
 * Search form of a text: lower case, accents removed, every run of whitespace = one space.
 * `map[j]` is the index in the original text of normalised character j.
 */
export function normalizeForSearch(text: string): { norm: string; map: number[] } {
  let norm = ''
  const map: number[] = []
  let lastWasSpace = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (/\s/.test(ch)) {
      if (!lastWasSpace && norm.length > 0) {
        norm += ' '
        map.push(i)
      }
      lastWasSpace = true
      continue
    }
    lastWasSpace = false
    const plain = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    for (const c of plain) {
      norm += c
      map.push(i)
    }
  }
  return { norm, map }
}

export const MIN_QUERY_LENGTH = 2

/** Normalised query, or null if it is too short to search for (spec: minimum 2 characters). */
export function prepareQuery(query: string): string | null {
  const q = normalizeForSearch(query).norm.trim()
  return q.length >= MIN_QUERY_LENGTH ? q : null
}

/** All non-overlapping matches of a prepared query, as [start, end) offsets in the original text. */
export function findMatches(text: string, preparedQuery: string): { start: number; end: number }[] {
  const { norm, map } = normalizeForSearch(text)
  const out: { start: number; end: number }[] = []
  let from = 0
  for (;;) {
    const j = norm.indexOf(preparedQuery, from)
    if (j < 0) break
    const last = j + preparedQuery.length - 1
    out.push({ start: map[j]!, end: map[last]! + 1 })
    from = j + preparedQuery.length
  }
  return out
}

/** Text around a match for the result list, on one line. */
export function snippet(text: string, start: number, end: number, radius = 40): { pre: string; match: string; post: string } {
  const clean = (s: string) => s.replace(/\s+/g, ' ')
  const preStart = Math.max(0, start - radius)
  const postEnd = Math.min(text.length, end + radius)
  return {
    pre: (preStart > 0 ? '…' : '') + clean(text.slice(preStart, start)).trimStart(),
    match: clean(text.slice(start, end)),
    post: clean(text.slice(end, postEnd)).trimEnd() + (postEnd < text.length ? '…' : '')
  }
}
