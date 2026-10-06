// Minimal type declarations for the parts of foliate-js we use (the package ships plain JS).
// Kept deliberately narrow: only what EpubAdapter touches. See skills/epub-rendering.md.

declare module 'foliate-js/view.js' {
  export interface FoliateTocItem {
    label: string
    href: string
    subitems?: FoliateTocItem[]
  }

  export interface FoliateSection {
    id: string
    linear?: string
    createDocument?: () => Promise<Document>
  }

  export interface FoliateBook {
    resolveHref(href: string): { index: number } | null
    metadata?: {
      title?: unknown
      author?: unknown
      language?: unknown
    }
    sections: FoliateSection[]
    toc?: FoliateTocItem[]
    dir?: string
  }

  export interface FoliateRelocateDetail {
    fraction: number
    location?: { current: number; next: number; total: number }
    section?: { current: number; total: number }
    tocItem?: FoliateTocItem | null
    cfi: string
    range: Range
  }

  export interface FoliateRenderer extends HTMLElement {
    readonly atStart: boolean
    readonly atEnd: boolean
    readonly sections: FoliateSection[]
    goTo(target: { index: number; anchor?: number | ((doc: Document) => number | Range | Element) }): Promise<void>
    setStyles(styles: string | [string, string]): void
    getContents(): { doc?: Document; index: number }[]
  }

  export interface FoliateView extends HTMLElement {
    book: FoliateBook
    renderer: FoliateRenderer
    lastLocation: FoliateRelocateDetail | null
    open(book: FoliateBook | File | Blob): Promise<void>
    init(opts: { lastLocation?: string; showTextStart?: boolean }): Promise<void>
    close(): void
    goTo(target: string | number): Promise<unknown>
    goToFraction(fraction: number): Promise<void>
    next(distance?: number): Promise<void>
    getCFI(index: number, range?: Range): string
    resolveNavigation(target: string | number): { index: number } | undefined
    addAnnotation(annotation: { value: string; [key: string]: unknown }, remove?: boolean): Promise<unknown>
    deleteAnnotation(annotation: { value: string }): Promise<unknown>
    prev(distance?: number): Promise<void>
  }

  export function makeBook(file: File | Blob | string): Promise<FoliateBook>
  export class View extends HTMLElement {}
}

declare module 'foliate-js/vendor/zip.js' {
  export function configure(opts: { useWebWorkers?: boolean }): void
  export class BlobReader {
    constructor(blob: Blob)
  }
  export class TextWriter {}
  export interface ZipEntry {
    filename: string
    getData(writer: TextWriter): Promise<string>
  }
  export class ZipReader {
    constructor(reader: BlobReader)
    getEntries(): Promise<ZipEntry[]>
    close(): Promise<void>
  }
}

declare module 'foliate-js/epubcfi.js' {
  /** Start (or end, with toEnd) point of a range CFI, as a CFI string. */
  export function collapse(cfi: string, toEnd?: boolean): string
  /** Book order: < 0 if a comes first, 0 if equal, > 0 if b comes first. */
  export function compare(a: string, b: string): number
}

declare module 'foliate-js/overlayer.js' {
  export type OverlayDraw = (rects: DOMRectList | DOMRect[], options?: Record<string, unknown>) => SVGElement
  export class Overlayer {
    static outline: OverlayDraw
    static highlight: OverlayDraw
  }
}

declare module 'foliate-js/search.js' {
  export interface SearchExcerpt {
    pre: string
    match: string
    post: string
  }
  export function searchMatcher(
    textWalker: unknown,
    opts: { defaultLocale?: string; matchCase?: boolean; matchDiacritics?: boolean; matchWholeWords?: boolean }
  ): (doc: Document, query: string) => Iterable<{ range: Range; excerpt: SearchExcerpt }>
}

declare module 'foliate-js/text-walker.js' {
  export const textWalker: unknown
}
