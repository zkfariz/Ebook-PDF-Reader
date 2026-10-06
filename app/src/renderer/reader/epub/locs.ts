// EPUB location maths on CFI strings (data-model.md §3).
import * as CFI from 'foliate-js/epubcfi.js'

/** The start point of a (range) CFI: used as a bookmark's location. */
export function cfiStart(cfi: string): string {
  return CFI.collapse(cfi)
}

/**
 * Is `loc` on the screen described by the visible range CFI?
 * Start inclusive, end exclusive, so a bookmark at the very start of the next page does not
 * also count for this one.
 */
export function rangeContains(rangeCfi: string, loc: string): boolean {
  try {
    return CFI.compare(CFI.collapse(rangeCfi), loc) <= 0 && CFI.compare(loc, CFI.collapse(rangeCfi, true)) < 0
  } catch {
    return false // malformed CFI (e.g. from an older edition of the book)
  }
}

/** Book order of two CFIs (for sorting bookmarks and highlights). */
export function compareCfi(a: string, b: string): number {
  try {
    return CFI.compare(a, b)
  } catch {
    return 0
  }
}
