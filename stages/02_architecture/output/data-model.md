# Data model · v1

Status: **draft, awaiting approval** · 2026-10-04

All data lives under `app.getPath('userData')` (installed app: `%APPDATA%\Ebook Reader\`). **Book files are never written.**

```
%APPDATA%\Ebook Reader\
  settings.json            global settings
  library.json             one entry per book
  books\<bookId>.json      per-book reading data (position, view, bookmarks, highlights)
```

Every file has a `schemaVersion`. Main validates it with zod when loading. If a file is invalid, it is renamed to `*.corrupt-<timestamp>.json` and defaults are used (nothing is silently lost).

**Atomic writes:** write `<file>.tmp` → `fsync` → `rename` over the original. A per-file write queue merges bursts, so only the latest pending write runs.

## 1 · Book identity

`bookId` = **SHA-256 of the whole file**, as hex (64 chars), computed in main with a stream. This takes about 0.2 s for a 50 MB file.
- Survives renaming and moving (F04.3).
- An edited file (for example re-saved in another app) gets a new id, because its anchors could be invalid anyway.
- `library.locate()` hashes the chosen file. If the hash differs, it returns `different-file` and the UI asks: "This looks like a different file. Use it anyway?" A yes re-keys the entry, keeps its bookmarks and highlights, and marks anchors that no longer resolve as "not found" in the lists.

## 2 · Files

### settings.json
```json
{
  "schemaVersion": 1,
  "theme": "night",
  "sidebar": { "open": true, "tab": "contents" },
  "window": { "x": 120, "y": 80, "width": 1280, "height": 860, "maximized": false }
}
```
`theme` is absent on first launch → use `app.systemTheme()`.

### library.json
```json
{
  "schemaVersion": 1,
  "books": {
    "9f86d08…e5b": {
      "bookId": "9f86d08…e5b",
      "format": "epub",
      "path": "D:\\Books\\pride-and-prejudice.epub",
      "fileName": "pride-and-prejudice.epub",
      "size": 812345,
      "title": "Pride and Prejudice",
      "author": "Jane Austen",
      "addedAt": "2026-10-04T09:10:00.000Z",
      "lastOpened": "2026-10-04T09:12:31.000Z",
      "progress": 0.37
    }
  }
}
```
- `title` falls back to `fileName` without its extension; `author` may be `null` (shown as "—").
- `path` is updated each time the same `bookId` is opened from a new location.
- "File not found" is not stored. It is detected when a book is opened, and the library list checks `fs.existsSync` on load to show ⚠.

### books/&lt;bookId&gt;.json
```json
{
  "schemaVersion": 1,
  "position": "epubcfi(/6/14!/4/2/10,/1:0,/1:120)",
  "view": { "epub": { "fontSize": 18, "fontFamily": "serif" } },
  "bookmarks": [
    { "id": "bm_01J9…", "loc": "epubcfi(/6/14!/4/2/10)", "label": "Chapter 3 · 37%", "createdAt": "2026-10-04T09:15:00.000Z" }
  ],
  "highlights": [
    {
      "id": "hl_01J9…",
      "anchor": { "kind": "epub", "cfi": "epubcfi(/6/14!/4/2/10,/1:5,/1:48)" },
      "text": "It is a truth universally acknowledged…",
      "color": "yellow",
      "note": "Famous opening line.",
      "createdAt": "2026-10-04T09:16:00.000Z",
      "updatedAt": "2026-10-04T09:17:10.000Z"
    }
  ]
}
```
- IDs are `bm_` / `hl_` + ULID (time-sortable, generated in the renderer).
- `note`: plain text, ≤ 5,000 chars; an empty string is stored as **absent** (F12.2).
- `view` stores only the active format's key.
- Lists are **sorted by book order** for display (comparing locations, §3); storage order does not matter.

### books/&lt;bookId&gt;.ocr.json (F16, added 2026-10-06 for v1.2.0)
Recognised text of a **scanned PDF**, kept in its own file so the main per-book file stays small and an OCR write never touches bookmarks or highlights. The file only exists once a page has been recognised.
```json
{
  "schemaVersion": 1,
  "engine": "tesseract.js 7 · eng best_int",
  "pages": {
    "12": {
      "lines": [
        { "t": "My experience of camp life in Afghanistan had at least", "b": [44.1, 40.2, 389.5, 52.0] }
      ]
    },
    "13": { "lines": [] }
  }
}
```
- `pages` is keyed by 1-based page number. A page with `"lines": []` was recognised but has no readable text ("No text found on this page", F16.8); it is not read again.
- `b` = `[x0, y0, x1, y1]` of the line in **PDF points, measured from the top-left of the unrotated page** (so it does not depend on the scale OCR ran at, or on zoom).
- **Line level, not word level.** The browser selects and highlights inside a line, so word boxes are not needed. A 500-word page is about 4 KB; a 240-page book is about 1 MB. (Word level would be about 10 times larger.)
- Written **one page at a time** through the same atomic, merged write queue as the other files, so closing the app mid-way keeps the finished pages (F16.7).
- Deleted together with `books/<id>.json` when the book is removed from the library (F16.9).
- Highlights and notes on recognised text use the existing PDF anchor (`page` + text offsets + stored `text` for repair). The recognised text is never re-created differently, because it is read from this file and not recomputed.
- The PDF file itself is never written to.

## 3 · Location & anchor formats

| | PDF | EPUB |
|---|---|---|
| **Position / bookmark `Loc`** | `"pdf:p=12"` (1-based page) | the CFI string from foliate-js `relocate.cfi` |
| **Highlight / search `Anchor`** | `{ "kind": "pdf", "page": 12, "start": 1043, "end": 1102 }`: character offsets into that page's `pageText` (see architecture §5) | `{ "kind": "epub", "cfi": "epubcfi(…,…,…)" }`: a CFI range |
| **Book-order comparison** | `(page, start)` | `CFI.compare()` from foliate-js `epubcfi.js` |
| **Bookmark "is this page bookmarked?"** | same page | the bookmark CFI falls inside the current visible range (`relocate.range`) |

**Why this survives zoom, resize and restart (architecture audit):** neither anchor contains pixels. PDF rectangles are rebuilt from the text layer on every render; EPUB rectangles are rebuilt by foliate-js's Overlayer after every relayout.

**Robustness:** each highlight also stores `text`. If a PDF anchor's `pageText.slice(start,end)` ≠ `text` (for example because a pdf.js upgrade changed text extraction), the adapter searches for `text` on that page and repairs the offsets. If it is still not found, the highlight shows in the list as "⚠ couldn't find on page" and is not drawn.

## 4 · TypeScript (`src/shared/model.ts`, sketch)

```ts
export interface LibraryEntry { bookId: string; format: 'pdf'|'epub'; path: string; fileName: string; size: number;
  title: string; author: string | null; addedAt: string; lastOpened: string; progress: number }
export type PdfAnchor  = { kind: 'pdf'; page: number; start: number; end: number };
export type EpubAnchor = { kind: 'epub'; cfi: string };
export interface Bookmark  { id: string; loc: string; label: string; createdAt: string }
export interface Highlight { id: string; anchor: PdfAnchor | EpubAnchor; text: string;
  color: 'yellow'|'green'|'blue'|'pink'; note?: string; createdAt: string; updatedAt: string }
export interface BookData  { schemaVersion: 1; position?: string;
  view: { pdf?: { zoom: number | 'fit-width' | 'fit-page' }; epub?: { fontSize: number; fontFamily: 'serif'|'sans' } };
  bookmarks: Bookmark[]; highlights: Highlight[] }
export interface Settings  { schemaVersion: 1; theme?: 'day'|'night'; sidebar: { open: boolean; tab: SidebarTab };
  window?: { x: number; y: number; width: number; height: number; maximized: boolean } }
```
The zod schemas in `src/shared/schemas.ts` mirror these types exactly; the types are derived with `z.infer` to keep a single source of truth.
