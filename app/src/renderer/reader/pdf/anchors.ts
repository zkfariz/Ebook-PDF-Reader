// Re-finding a PDF highlight's text on its page (data-model.md §3 "Robustness").
import { findMatches, prepareQuery } from './pageText'

/**
 * Where [start, end) should be on this page for a highlight that said `stored`.
 * Same offsets if the text still matches; otherwise the first exact, then the first
 * accent/case-insensitive occurrence (e.g. after a pdf.js upgrade changed text extraction);
 * null if the text is gone.
 */
export function resolvePdfOffsets(
  pageText: string,
  start: number,
  end: number,
  stored: string
): { start: number; end: number } | null {
  if (pageText.slice(start, end) === stored) return { start, end }
  const exact = pageText.indexOf(stored)
  if (exact >= 0) return { start: exact, end: exact + stored.length }
  const q = prepareQuery(stored)
  const loose = q ? findMatches(pageText, q)[0] : undefined
  return loose ?? null
}
