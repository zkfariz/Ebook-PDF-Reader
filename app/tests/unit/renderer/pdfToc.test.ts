import { describe, expect, it } from 'vitest'
import { currentTocId } from '../../../src/renderer/reader/pdf/pdfToc'

// Same shape as tests/fixtures/toc.pdf: Part One (p1) › Ch 1 (p1), Ch 2 (p3); Part Two (p4) › Ch 3 (p4), Ch 4 (p6)
const pages = [
  { id: '0', page: 1 },
  { id: '0.0', page: 1 },
  { id: '0.1', page: 3 },
  { id: '1', page: 4 },
  { id: '1.0', page: 4 },
  { id: '1.1', page: 6 }
]

describe('currentTocId (F10.4)', () => {
  it('picks the deepest entry that starts on or before the page', () => {
    expect(currentTocId(pages, 1)).toBe('0.0')
    expect(currentTocId(pages, 2)).toBe('0.0')
    expect(currentTocId(pages, 3)).toBe('0.1')
    expect(currentTocId(pages, 5)).toBe('1.0')
    expect(currentTocId(pages, 6)).toBe('1.1')
  })

  it('is undefined before the first entry or without a TOC', () => {
    expect(currentTocId([{ id: '0', page: 5 }], 2)).toBeUndefined()
    expect(currentTocId([], 3)).toBeUndefined()
  })
})
