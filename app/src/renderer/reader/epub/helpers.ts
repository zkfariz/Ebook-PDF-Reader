// Small EPUB helpers kept out of EpubAdapter.

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * Resolves once the view has gone `quietMs` without a relocate event (max `maxMs`).
 * foliate lays the first section out again shortly after init (e.g. when fonts finish loading);
 * a page turn during that re-layout would be undone, so "ready" waits for it to settle.
 */
export function settled(view: HTMLElement, quietMs = 300, maxMs = 2000): Promise<void> {
  return new Promise((resolve) => {
    let timer = window.setTimeout(done, quietMs)
    const cap = window.setTimeout(done, maxMs)
    const onRelocate = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(done, quietMs)
    }
    view.addEventListener('relocate', onRelocate)
    function done() {
      window.clearTimeout(timer)
      window.clearTimeout(cap)
      view.removeEventListener('relocate', onRelocate)
      resolve()
    }
  })
}

/** Each section is its own iframe: forward its key presses and file drops to the app window. */
export function forwardInput(doc: Document): void {
  doc.addEventListener('keydown', (ke) => {
    const copy = new KeyboardEvent('keydown', {
      key: ke.key,
      code: ke.code,
      ctrlKey: ke.ctrlKey,
      shiftKey: ke.shiftKey,
      altKey: ke.altKey,
      metaKey: ke.metaKey,
      cancelable: true
    })
    if (!window.dispatchEvent(copy)) ke.preventDefault() // the app handled it
  })
  doc.addEventListener('dragover', (de) => de.preventDefault())
  doc.addEventListener('drop', (de) => {
    de.preventDefault()
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: de.dataTransfer, cancelable: true }))
  })
}

/** EPUB metadata strings can be plain or language maps ({ en: '…' }) or { name: … } objects. */
export function plainText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  if (value && typeof value === 'object') {
    if ('name' in value) return plainText((value as { name: unknown }).name)
    const first = Object.values(value as Record<string, unknown>)[0]
    return plainText(first)
  }
  return undefined
}

export function authors(value: unknown): string | undefined {
  const list = Array.isArray(value) ? value : [value]
  const names = list.map(plainText).filter((n): n is string => !!n)
  return names.length ? names.join(', ') : undefined
}
