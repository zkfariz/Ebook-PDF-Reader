import type { TextContent } from 'pdfjs-dist/types/src/display/api'
import type { OcrLine } from '@shared/schemas'

/** Font used for the invisible text over a scanned page. Only its size and width matter. */
export const OCR_FONT = 'ocr'

/**
 * Turns recognised lines (PDF points from the top-left of the unrotated page, data-model.md) into the
 * text content pdf.js would have produced for a normal page: one item per line, in user space.
 * The existing text layer, search and highlight code then work on scanned pages unchanged.
 * `view` is the page's [xMin, yMin, xMax, yMax] (pdf.js `page.view`).
 */
export function buildOcrContent(lines: readonly OcrLine[], view: readonly [number, number, number, number]): TextContent {
  const items = lines.map((line) => {
    const [x0, y0, x1, y1] = line.b
    const height = Math.max(1, y1 - y0)
    // A recognised line box runs from the top of the tallest letter to the bottom of the lowest, which is
    // a little more than the font size. The baseline sits about a fifth of the box above its bottom edge.
    const fontSize = height * 0.85
    const baseline = view[3] - y1 + height * 0.2
    return {
      str: line.t,
      dir: 'ltr',
      transform: [fontSize, 0, 0, fontSize, view[0] + x0, baseline],
      width: Math.max(1, x1 - x0),
      height: fontSize,
      fontName: OCR_FONT,
      hasEOL: true
    }
  })
  return {
    items,
    styles: { [OCR_FONT]: { fontFamily: 'sans-serif', ascent: 0.9, descent: -0.2, vertical: false } },
    lang: 'en'
  } as TextContent
}
