import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sniffFormat } from '../../src/main/sniff'

const fixture = (name: string) => readFileSync(join(__dirname, '../fixtures', name))
const bytes = (s: string) => new TextEncoder().encode(s)

describe('sniffFormat', () => {
  it('recognises a real PDF', () => {
    expect(sniffFormat(fixture('sample-3p.pdf'), 'sample-3p.pdf')).toBe('pdf')
  })

  it('accepts a PDF header after some leading junk', () => {
    expect(sniffFormat(bytes('\n\n  junk %PDF-1.4 ...'), 'a.PDF')).toBe('pdf')
  })

  it('recognises an EPUB by ZIP signature + .epub name', () => {
    expect(sniffFormat(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]), 'book.epub')).toBe('epub')
  })

  it('rejects a ZIP named .pdf and a text file named .pdf', () => {
    expect(sniffFormat(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 'fake.pdf')).toBeNull()
    expect(sniffFormat(bytes('hello'), 'fake.pdf')).toBeNull()
  })

  it('rejects other extensions even with PDF content', () => {
    expect(sniffFormat(fixture('sample-3p.pdf'), 'sample.txt')).toBeNull()
  })
})
