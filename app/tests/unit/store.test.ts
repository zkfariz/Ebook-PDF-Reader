import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { JsonFile } from '../../src/main/store/jsonFile'
import { Store } from '../../src/main/store/store'
import { emptyBookData, sortLibrary, type LibraryEntry } from '../../src/shared/schemas'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ebook-store-'))
})

const Counter = z.object({ n: z.number() })
const id = (c: string) => c.repeat(64)
const entry = (bookId: string, lastOpened: string, extra: Partial<LibraryEntry> = {}): LibraryEntry => ({
  bookId,
  format: 'pdf',
  path: join(dir, 'missing.pdf'),
  fileName: 'missing.pdf',
  size: 1,
  title: 'T',
  author: null,
  addedAt: lastOpened,
  lastOpened,
  progress: 0,
  ...extra
})

describe('JsonFile', () => {
  it('returns defaults when the file does not exist', async () => {
    const f = new JsonFile(join(dir, 'a.json'), Counter, () => ({ n: 0 }))
    expect(await f.read()).toEqual({ n: 0 })
  })

  it('writes atomically and leaves no temp file', async () => {
    const f = new JsonFile(join(dir, 'a.json'), Counter, () => ({ n: 0 }))
    await f.write({ n: 5 })
    expect(JSON.parse(readFileSync(join(dir, 'a.json'), 'utf8'))).toEqual({ n: 5 })
    expect(existsSync(join(dir, 'a.json.tmp'))).toBe(false)
  })

  it('merges a burst of writes: the last value wins', async () => {
    const f = new JsonFile(join(dir, 'a.json'), Counter, () => ({ n: 0 }))
    const all = Array.from({ length: 50 }, (_, i) => f.write({ n: i }))
    await Promise.all(all)
    expect(JSON.parse(readFileSync(join(dir, 'a.json'), 'utf8'))).toEqual({ n: 49 })
    expect(await new JsonFile(join(dir, 'a.json'), Counter, () => ({ n: 0 })).read()).toEqual({ n: 49 })
  })

  it('keeps a corrupt file aside and falls back to defaults', async () => {
    writeFileSync(join(dir, 'a.json'), '{ this is not json')
    const f = new JsonFile(join(dir, 'a.json'), Counter, () => ({ n: 0 }))
    expect(await f.read()).toEqual({ n: 0 })
    expect(readdirSync(dir).some((name) => /^a\.corrupt-.*\.json$/.test(name))).toBe(true)
  })

  it('treats a schema-invalid file as corrupt', async () => {
    writeFileSync(join(dir, 'a.json'), JSON.stringify({ n: 'five' }))
    expect(await new JsonFile(join(dir, 'a.json'), Counter, () => ({ n: 0 })).read()).toEqual({ n: 0 })
  })

  it('refuses to write invalid data', () => {
    const f = new JsonFile(join(dir, 'a.json'), Counter, () => ({ n: 0 }))
    expect(() => f.write({ n: 'x' } as unknown as { n: number })).toThrow()
  })
})

describe('Store', () => {
  it('lists the library newest first and flags missing files', async () => {
    const s = new Store(dir)
    const present = join(dir, 'present.pdf')
    writeFileSync(present, '%PDF-1.4')
    await s.upsertEntry(entry(id('a'), '2026-10-01T10:00:00.000Z'))
    await s.upsertEntry(entry(id('b'), '2026-10-03T10:00:00.000Z', { path: present }))
    const list = await s.listLibrary()
    expect(list.map((e) => e.bookId)).toEqual([id('b'), id('a')])
    expect(list.map((e) => e.missing)).toEqual([false, true])
  })

  it('concurrent updates do not lose each other', async () => {
    const s = new Store(dir)
    await Promise.all(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((c) => s.upsertEntry(entry(id(c), '2026-10-01T10:00:00.000Z')))
    )
    expect((await new Store(dir).listLibrary()).length).toBe(6)
  })

  it('remove deletes the entry and its reading data, not the book', async () => {
    const s = new Store(dir)
    const book = join(dir, 'book.pdf')
    writeFileSync(book, '%PDF-1.4')
    await s.upsertEntry(entry(id('a'), '2026-10-01T10:00:00.000Z', { path: book }))
    await s.putBookData(id('a'), { ...emptyBookData(), position: 'pdf:p=7' })
    expect(existsSync(join(dir, 'books', `${id('a')}.json`))).toBe(true)
    await s.removeEntry(id('a'))
    expect(await s.listLibrary()).toEqual([])
    expect(existsSync(join(dir, 'books', `${id('a')}.json`))).toBe(false)
    expect(existsSync(book)).toBe(true)
  })

  it('rekey moves reading data to the new id', async () => {
    const s = new Store(dir)
    await s.upsertEntry(entry(id('a'), '2026-10-01T10:00:00.000Z'))
    await s.putBookData(id('a'), { ...emptyBookData(), position: 'pdf:p=3' })
    await s.rekey(id('a'), entry(id('b'), '2026-10-02T10:00:00.000Z'))
    expect((await s.listLibrary()).map((e) => e.bookId)).toEqual([id('b')])
    expect((await s.getBookData(id('b'))).position).toBe('pdf:p=3')
    expect(existsSync(join(dir, 'books', `${id('a')}.json`))).toBe(false)
  })

  it('rejects book ids that are not SHA-256 hex (no path tricks)', async () => {
    const s = new Store(dir)
    await expect(async () => s.getBookData('../../evil')).rejects.toThrow()
  })

  it('sortLibrary is newest first', () => {
    const list = sortLibrary([entry(id('a'), '2026-01-01T00:00:00Z'), entry(id('b'), '2026-02-01T00:00:00Z')])
    expect(list[0]!.bookId).toBe(id('b'))
  })
})
