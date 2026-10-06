import type { OcrLine } from '@shared/schemas'

/** The part of a pdf.js PageViewport that is needed here (so this file can be tested without pdf.js). */
export interface ViewportLike {
  convertToPdfPoint(x: number, y: number): number[]
}

/** A line as the engine reports it: pixels of the bitmap that was recognised, origin top-left. */
export interface PixelLine {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

/**
 * Converts a pixel box to the stored form (data-model.md): PDF points measured from the top-left
 * of the unrotated page. Going through the viewport makes page rotation and the render scale
 * disappear, so stored lines stay valid at any zoom.
 * `view` is the page's [xMin, yMin, xMax, yMax] in PDF user space (pdf.js `page.view`).
 */
export function toStoredLine(
  line: PixelLine,
  viewport: ViewportLike,
  view: readonly [number, number, number, number]
): OcrLine | null {
  const text = line.text.replace(/\s+/g, ' ').trim()
  if (!text) return null
  const [ax, ay] = viewport.convertToPdfPoint(line.bbox.x0, line.bbox.y0) as [number, number]
  const [bx, by] = viewport.convertToPdfPoint(line.bbox.x1, line.bbox.y1) as [number, number]
  const round = (n: number) => Math.round(n * 100) / 100
  const x0 = Math.min(ax, bx) - view[0]
  const x1 = Math.max(ax, bx) - view[0]
  const y0 = view[3] - Math.max(ay, by) // user space has y up; stored boxes have y down
  const y1 = view[3] - Math.min(ay, by)
  return { t: text, b: [round(x0), round(y0), round(x1), round(y1)] }
}
