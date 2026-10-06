import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { Store } from '../../src/main/store/store'
import { OcrFileSchema, OcrLineSchema, type LibraryEntry } from '../../src/shared/schemas'

// F16: recognised text of scanned PDFs, stored per book in books/<id>.ocr.json.
let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ebook-ocr-'))
})

const id = (c: string) => c.repeat(64)
const file = (bookId: string) => join(dir, 'books', `${bookId}.ocr.json`)
const line = (t: string, y = 40) => ({ t, b: [44.1, y, 389.5, y + 12] as [number, number, number, number] })
const entry = (bookId: string): LibraryEntry => ({
  bookId,
  format: 'pdf',
  path: join(dir, 'x.pdf'),
  fileName: 'x.pdf',
  size: 1,
  title: 'T',
  author: null,
  addedAt: '2026-10-06T00:00:00.000Z',
  lastOpened: '2026-10-06T00:00:00.000Z',
  progress: 0
})

describe('Store · recognised text (F16)', () => {
  it('has no pages before anything is recognised, and writes no file', async () => {
    const store = new Store(dir)
    expect((await store.getOcr(id('a'))).pages).toEqual({})
    expect(existsSync(file(id('a')))).toBe(false)
  })

  it('keeps recognised pages, including an empty one, after a restart', async () => {
    const store = new Store(dir)
    await store.putOcrPage(id('a'), 12, [line('My experience of camp life')])
    await store.putOcrPage(id('a'), 13, [])
    await store.flushAll()

    const again = new Store(dir)
    const ocr = await again.getOcr(id('a'))
    expect(ocr.pages['12']!.lines[0]!.t).toBe('My experience of camp life')
    expect(ocr.pages['13']).toEqual({ lines: [] })
    expect(JSON.parse(readFileSync(file(id('a')), 'utf8')).schemaVersion).toBe(1)
  })

  it('a burst of pages ends with all of them on disk', async () => {
    const store = new Store(dir)
    await Promise.all(Array.from({ length: 20 }, (_, i) => store.putOcrPage(id('a'), i + 1, [line(`page ${i + 1}`)])))
    await store.flushAll()
    const ocr = await new Store(dir).getOcr(id('a'))
    expect(Object.keys(ocr.pages)).toHaveLength(20)
  })

  it('recognising a page again replaces it', async () => {
    const store = new Store(dir)
    await store.putOcrPage(id('a'), 1, [line('old')])
    await store.putOcrPage(id('a'), 1, [line('new')])
    expect((await store.getOcr(id('a'))).pages['1']!.lines).toEqual([line('new')])
  })

  it('removing a book from the library removes its recognised text too (F16.9)', async () => {
    const store = new Store(dir)
    await store.upsertEntry(entry(id('a')))
    await store.putOcrPage(id('a'), 1, [line('text')])
    await store.flushAll()
    expect(existsSync(file(id('a')))).toBe(true)
    await store.removeEntry(id('a'))
    expect(existsSync(file(id('a')))).toBe(false)
    expect((await store.getOcr(id('a'))).pages).toEqual({})
  })

  it('rekey moves recognised text to the new id', async () => {
    const store = new Store(dir)
    await store.upsertEntry(entry(id('a')))
    await store.putOcrPage(id('a'), 3, [line('moved')])
    await store.rekey(id('a'), entry(id('b')))
    await store.flushAll()
    expect((await store.getOcr(id('b'))).pages['3']!.lines[0]!.t).toBe('moved')
    expect(existsSync(file(id('a')))).toBe(false)
  })

  it('rejects book ids that are not SHA-256 hex (the id becomes a file name)', async () => {
    const store = new Store(dir)
    await expect(store.putOcrPage('../evil', 1, [])).rejects.toThrow()
    expect(() => store.getOcr('..\evil')).toThrow()
  })
})

describe('OcrFileSchema', () => {
  it('accepts only sensible lines and page numbers', () => {
    expect(OcrLineSchema.safeParse({ t: 'ok', b: [0, 0, 10, 10] }).success).toBe(true)
    expect(OcrLineSchema.safeParse({ t: '', b: [0, 0, 10, 10] }).success).toBe(false)
    expect(OcrLineSchema.safeParse({ t: 'ok', b: [0, 0, 10] }).success).toBe(false)
    const base = { schemaVersion: 1, engine: 'x' }
    expect(OcrFileSchema.safeParse({ ...base, pages: { '1': { lines: [] } } }).success).toBe(true)
    expect(OcrFileSchema.safeParse({ ...base, pages: { '0': { lines: [] } } }).success).toBe(false)
    expect(OcrFileSchema.safeParse({ ...base, pages: { abc: { lines: [] } } }).success).toBe(false)
  })
})
