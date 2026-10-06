import { describe, expect, it } from 'vitest'
import { toStoredLine, type ViewportLike } from '../../src/renderer/reader/ocr/ocrGeometry'

// A PDF page's user space has y pointing up. pdf.js's viewport maps bitmap pixels to it.
/** An unrotated page of 612 x 792 points, view [0, 0, 612, 792], rendered at `scale`. */
const upright = (scale: number): ViewportLike => ({
  convertToPdfPoint: (x, y) => [x / scale, 792 - y / scale]
})

describe('toStoredLine', () => {
  it('converts pixels to PDF points from the top-left, whatever the render scale', () => {
    const line = { text: 'Hello world', bbox: { x0: 100, y0: 200, x1: 500, y1: 240 } }
    expect(toStoredLine(line, upright(2), [0, 0, 612, 792])).toEqual({ t: 'Hello world', b: [50, 100, 250, 120] })
    // Same line seen at twice the scale (pixels doubled) gives the same stored box.
    const doubled = { text: 'Hello world', bbox: { x0: 200, y0: 400, x1: 1000, y1: 480 } }
    expect(toStoredLine(doubled, upright(4), [0, 0, 612, 792])).toEqual({ t: 'Hello world', b: [50, 100, 250, 120] })
  })

  it('allows for a page whose view does not start at 0, 0', () => {
    const vp: ViewportLike = { convertToPdfPoint: (x, y) => [10 + x, 812 - y] } // view [10, 20, 622, 812]
    const line = { text: 'Offset', bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } }
    expect(toStoredLine(line, vp, [10, 20, 622, 812])).toEqual({ t: 'Offset', b: [0, 0, 100, 20] })
  })

  it('tidies whitespace and drops lines with no text', () => {
    const box = { x0: 0, y0: 0, x1: 10, y1: 10 }
    expect(toStoredLine({ text: '  a \n  b\t c ', bbox: box }, upright(1), [0, 0, 612, 792])?.t).toBe('a b c')
    expect(toStoredLine({ text: ' \n ', bbox: box }, upright(1), [0, 0, 612, 792])).toBeNull()
  })

  it('keeps boxes the right way round on a rotated page', () => {
    // A page rotated 90 degrees: pixel x runs along user-space y and the other way round.
    const rotated: ViewportLike = { convertToPdfPoint: (x, y) => [y, x] }
    const out = toStoredLine({ text: 'Turned', bbox: { x0: 10, y0: 20, x1: 110, y1: 50 } }, rotated, [0, 0, 612, 792])!
    const [x0, y0, x1, y1] = out.b
    expect(x1).toBeGreaterThan(x0)
    expect(y1).toBeGreaterThan(y0)
  })
})
