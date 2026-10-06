// Stored data shapes (data-model.md). Main validates every IPC payload and every file it loads
// against these; the TypeScript types are derived from them, so there is one source of truth.
import { z } from 'zod'

export const BookIdSchema = z.string().regex(/^[0-9a-f]{64}$/) // SHA-256 hex
export const FormatSchema = z.enum(['pdf', 'epub'])
const IsoDate = z.string().min(10).max(40)

export const LibraryEntrySchema = z.object({
  bookId: BookIdSchema,
  format: FormatSchema,
  path: z.string().min(1).max(4096),
  fileName: z.string().min(1).max(1024),
  size: z.number().int().nonnegative(),
  title: z.string().min(1).max(1024),
  author: z.string().max(1024).nullable(),
  addedAt: IsoDate,
  lastOpened: IsoDate,
  progress: z.number().min(0).max(1)
})

export const LibraryFileSchema = z.object({
  schemaVersion: z.literal(1),
  books: z.record(z.string(), LibraryEntrySchema)
})

export const PdfAnchorSchema = z.object({
  kind: z.literal('pdf'),
  page: z.number().int().positive(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative()
})
export const EpubAnchorSchema = z.object({ kind: z.literal('epub'), cfi: z.string().min(1).max(2000) })
export const AnchorSchema = z.discriminatedUnion('kind', [PdfAnchorSchema, EpubAnchorSchema])

export const HlColorSchema = z.enum(['yellow', 'green', 'blue', 'pink'])

export const BookmarkSchema = z.object({
  id: z.string().min(1).max(64),
  loc: z.string().min(1).max(2000),
  label: z.string().max(300),
  createdAt: IsoDate
})

export const HighlightSchema = z.object({
  id: z.string().min(1).max(64),
  anchor: AnchorSchema,
  text: z.string().max(20000),
  color: HlColorSchema,
  note: z.string().min(1).max(5000).optional(),
  createdAt: IsoDate,
  updatedAt: IsoDate
})

export const PdfZoomSchema = z.union([z.number().min(0.25).max(8), z.enum(['fit-width', 'fit-page'])])

export const BookViewSchema = z.object({
  pdf: z.object({ zoom: PdfZoomSchema }).optional(),
  epub: z.object({ fontSize: z.number().int().min(10).max(40), fontFamily: z.enum(['serif', 'sans']) }).optional()
})

export const BookDataSchema = z.object({
  schemaVersion: z.literal(1),
  position: z.string().min(1).max(2000).optional(),
  view: BookViewSchema,
  bookmarks: z.array(BookmarkSchema).max(10000),
  highlights: z.array(HighlightSchema).max(10000)
})

/** One recognised line of a scanned page (F16). `b` = [x0, y0, x1, y1] in PDF points from the top-left of the unrotated page. */
export const OcrLineSchema = z.object({
  t: z.string().min(1).max(2000),
  b: z.tuple([z.number(), z.number(), z.number(), z.number()])
})

export const OcrFileSchema = z.object({
  schemaVersion: z.literal(1),
  engine: z.string().max(200),
  /** Keyed by 1-based page number. An empty `lines` array = recognised, nothing readable on it. */
  pages: z.record(z.string().regex(/^[1-9][0-9]{0,5}$/), z.object({ lines: z.array(OcrLineSchema).max(5000) }))
})

export const SidebarTabSchema = z.enum(['contents', 'bookmarks', 'highlights', 'search'])

export const WindowBoundsSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().min(200),
  height: z.number().int().min(200),
  maximized: z.boolean()
})

export const SettingsSchema = z.object({
  schemaVersion: z.literal(1),
  theme: z.enum(['day', 'night']).optional(),
  sidebar: z.object({ open: z.boolean(), tab: SidebarTabSchema }),
  window: WindowBoundsSchema.optional()
})

/** What the renderer may change in settings (window bounds are main's business). */
export const SettingsPatchSchema = SettingsSchema.pick({ theme: true, sidebar: true }).partial()

export type Anchor = z.infer<typeof AnchorSchema>
export type LibraryEntry = z.infer<typeof LibraryEntrySchema>
export type LibraryFile = z.infer<typeof LibraryFileSchema>
export type Bookmark = z.infer<typeof BookmarkSchema>
export type Highlight = z.infer<typeof HighlightSchema>
export type OcrLine = z.infer<typeof OcrLineSchema>
export type OcrFile = z.infer<typeof OcrFileSchema>
export type BookData = z.infer<typeof BookDataSchema>
export type BookView = z.infer<typeof BookViewSchema>
export type Settings = z.infer<typeof SettingsSchema>
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>
export type WindowBounds = z.infer<typeof WindowBoundsSchema>

export const emptyBookData = (): BookData => ({ schemaVersion: 1, view: {}, bookmarks: [], highlights: [] })
export const defaultSettings = (): Settings => ({ schemaVersion: 1, sidebar: { open: true, tab: 'contents' } })
export const OCR_ENGINE = 'tesseract.js 7 · eng best_int'
export const emptyOcr = (): OcrFile => ({ schemaVersion: 1, engine: OCR_ENGINE, pages: {} })
export const emptyLibrary = (): LibraryFile => ({ schemaVersion: 1, books: {} })

/** Library list order: most recently opened first (F04). */
export function sortLibrary(entries: LibraryEntry[]): LibraryEntry[] {
  return [...entries].sort((a, b) => b.lastOpened.localeCompare(a.lastOpened))
}
