import { describe, expect, it } from 'vitest'
import {
  buildPageText,
  findMatches,
  locateOffset,
  normalizeForSearch,
  prepareQuery,
  snippet
} from '../../../src/renderer/reader/pdf/pageText'

const items = [{ str: 'The Café', hasEOL: true }, { str: 'crème  BRÛLÉE' }, { str: ' and more' }]

describe('page text model', () => {
  it('joins items and marks line ends', () => {
    const pt = buildPageText(items)
    expect(pt.text).toBe('The Café\ncrème  BRÛLÉE and more')
    expect(pt.starts).toEqual([0, 9, 22])
  })

  it('locates an offset inside its item', () => {
    const pt = buildPageText(items)
    expect(locateOffset(pt, items, 0)).toEqual({ item: 0, offset: 0 })
    expect(locateOffset(pt, items, 10)).toEqual({ item: 1, offset: 1 })
    expect(locateOffset(pt, items, 8)).toEqual({ item: 0, offset: 8 }) // the "\n" clamps to the item end
  })
})

describe('search normalisation (F09: case- and accent-insensitive)', () => {
  it('lowercases, strips accents, collapses whitespace', () => {
    expect(normalizeForSearch('  Crème\n\n BRÛLÉE ').norm).toBe('creme brulee ')
  })

  it('needs at least 2 characters', () => {
    expect(prepareQuery('a')).toBeNull()
    expect(prepareQuery('  ')).toBeNull()
    expect(prepareQuery('Ab')).toBe('ab')
  })

  it('finds matches and maps them back to the original text', () => {
    const { text } = buildPageText(items)
    const hits = findMatches(text, prepareQuery('creme brulee')!)
    expect(hits).toHaveLength(1)
    expect(text.slice(hits[0]!.start, hits[0]!.end)).toBe('crème  BRÛLÉE')
  })

  it('matches across a line break and finds every occurrence', () => {
    const { text } = buildPageText(items)
    expect(findMatches(text, prepareQuery('cafe creme')!).map((h) => text.slice(h.start, h.end))).toEqual(['Café\ncrème'])
    expect(findMatches('the THE tHe', prepareQuery('the')!)).toHaveLength(3)
  })

  it('makes a one-line snippet with ellipses', () => {
    const text = 'x'.repeat(60) + ' needle ' + 'y'.repeat(60)
    const [hit] = findMatches(text, 'needle')
    const s = snippet(text, hit!.start, hit!.end, 10)
    expect(s.match).toBe('needle')
    expect(s.pre.startsWith('…')).toBe(true)
    expect(s.post.endsWith('…')).toBe(true)
  })
})
