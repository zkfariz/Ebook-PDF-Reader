import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { z } from 'zod'

/**
 * One JSON file on disk, validated with a zod schema (data-model.md).
 * - Loaded once, then served from memory: every reader sees the latest value, so concurrent
 *   read-modify-write calls in main never lose each other's changes.
 * - Missing file → defaults.
 * - Unreadable or invalid file → renamed to `*.corrupt-<time>.json` (nothing silently lost), defaults used.
 * - Writes are atomic (temp file + rename) and merged: a burst of writes only writes the latest value.
 */
export class JsonFile<S extends z.ZodType> {
  private cache?: Promise<z.infer<S>>
  private chain: Promise<void> = Promise.resolve()
  private latest: z.infer<S> | undefined

  constructor(
    readonly path: string,
    private readonly schema: S,
    private readonly defaults: () => z.infer<S>
  ) {}

  read(): Promise<z.infer<S>> {
    this.cache ??= this.load()
    return this.cache
  }

  /** Resolves once this value (or a newer one) is safely on disk. */
  write(value: z.infer<S>): Promise<void> {
    const parsed = this.schema.parse(value)
    this.cache = Promise.resolve(parsed)
    this.latest = parsed
    this.chain = this.chain.then(() => this.flushLatest())
    return this.chain
  }

  /** Waits for all queued writes (used before quitting). */
  flush(): Promise<void> {
    return this.chain
  }

  async remove(): Promise<void> {
    this.latest = undefined
    this.cache = undefined
    await this.chain
    await rm(this.path, { force: true })
  }

  private async load(): Promise<z.infer<S>> {
    let text: string
    try {
      text = await readFile(this.path, 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return this.defaults()
      throw err
    }
    try {
      return this.schema.parse(JSON.parse(text))
    } catch {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      await rename(this.path, this.path.replace(/\.json$/, `.corrupt-${stamp}.json`)).catch(() => {})
      return this.defaults()
    }
  }

  private async flushLatest(): Promise<void> {
    const value = this.latest
    if (value === undefined) return // already written by an earlier link of the chain
    this.latest = undefined
    try {
      await atomicWrite(this.path, JSON.stringify(value, null, 2))
    } catch (err) {
      console.error(`[store] could not write ${this.path}`, err)
    }
  }
}

async function atomicWrite(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, text, { encoding: 'utf8', flush: true })
  // Windows can briefly lock the target (antivirus, indexer): retry a few times.
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(tmp, path)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (attempt >= 5 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw err
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)))
    }
  }
}
