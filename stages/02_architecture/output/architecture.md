# Architecture · v1

Status: **draft, awaiting approval** · 2026-10-04 · Inputs: `01_spec/output/spec.md` (approved), `_config/tech-stack.md`, `skills/*`

## 1 · Confirmed stack

Versions were checked on npm on 2026-10-04. Dev machine: Node 22.23 / npm 10.9 ✔.

| Concern | Package | Version | Note |
|---|---|---|---|
| Desktop shell | `electron` | ^44.5 | |
| Build tooling | `electron-vite` | ^5.0 | Supports Vite ≤ 7 only, so **Vite is pinned to 7** |
| Bundler | `vite` | ^7.3 | Not 8 (see above) |
| UI | `react`, `react-dom` | ^19.3 | State with `useReducer` + context; no state library |
| React plugin | `@vitejs/plugin-react` | ^5.2 | The 6.x line needs Vite 8 |
| Language | `typescript` | ^7.0 | Type-check only (Vite transpiles). Fallback: TS 6 if a tool breaks on 7 |
| PDF engine | `pdfjs-dist` | ^6.4 | |
| **EPUB engine** | **`foliate-js`** | ^1.0.1 | **Changed from epub.js** (see decisions log). S3 starts with a spike |
| Validation | `zod` | latest | Validates every IPC payload and stored JSON in main |
| Unit tests | `vitest` | ^5.0 | Supports Vite 7 |
| E2E smoke | `@playwright/test` | ^1.63 | `_electron.launch()` |
| Installer | `electron-builder` | ^26.15 | NSIS |

## 2 · Process boundary

```
┌──────────────────────── Electron MAIN (Node) ────────────────────────┐
│ window.ts      BrowserWindow, bounds save/restore, full screen,      │
│                security hardening, offline request blocker           │
│ menu.ts        minimal app menu (no DevTools in production)          │
│ files.ts       open dialog, read file → ArrayBuffer, SHA-256 hash    │
│ store/         jsonStore (atomic write queue), library, bookData,    │
│                settings  ← all paths under app.getPath('userData')   │
│ ipc.ts         registers handlers; zod-validates every argument      │
└──────────────────────────────┬───────────────────────────────────────┘
                 contextBridge │ window.api (typed, see §4)
┌──────────────────────────────┴───── PRELOAD (sandboxed) ─────────────┐
│ exposes window.api.*  + getPathForFile(File) for drag & drop         │
└──────────────────────────────┬───────────────────────────────────────┘
┌──────────────────────────────┴───── RENDERER (no Node) ──────────────┐
│ app/        App shell, screen router (Library | Reader), shortcuts   │
│ ui/         Toolbar, Sidebar, Popup, Dialog, theme.css (tokens)      │
│ features/   library · toc · bookmarks · highlights · search ·        │
│             settings (theme, view)                                   │
│ reader/     ReaderAdapter interface                                  │
│   pdf/      PdfAdapter (pdfjs-dist: canvas + TextLayer + overlay)    │
│   epub/     EpubAdapter (foliate-js <foliate-view>)                  │
└──────────────────────────────────────────────────────────────────────┘
```

**Rules**
- The renderer never touches the file system. Book bytes come from main as an `ArrayBuffer`. Copying 50 MB over IPC is acceptable; a streaming `book://` protocol is a later optimisation if needed.
- `features/*` and `ui/*` import only `reader/ReaderAdapter.ts`, never pdfjs or foliate-js.
- **Main owns persistence.** The renderer keeps the current book's state in memory and sends whole-document saves (`bookData.put`). Main validates the data and writes it atomically.

## 3 · Security & offline hardening (main/window.ts)

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`.
- CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' blob: data:; worker-src 'self' blob:; frame-src blob:; connect-src 'self' blob:`. (In dev, the Vite dev-server origin is added.)
- **Offline enforcement:** `session.defaultSession.webRequest.onBeforeRequest` cancels every request whose scheme is not `file:`, `blob:`, `data:` or `devtools:` (plus `http://localhost:<vite>` in dev). This also blocks remote images/fonts that EPUBs try to load.
- `will-navigate` is prevented; `setWindowOpenHandler` → `deny`. External links in books open in the default browser only after a confirm dialog (`shell.openExternal`, `https:` only).
- EPUB content runs in foliate-js iframes. The spike in S3 confirms that EPUB scripts cannot run (sandboxed iframe / CSP). If they can, block them before shipping.
- Production builds: no DevTools, no default menu, `Ctrl+Shift+I` disabled.

## 4 · IPC API (`src/shared/ipc.ts`)

All calls are `invoke` (request → promise) unless marked *event*.

| Call | Args | Returns | Used by |
|---|---|---|---|
| `files.openDialog()` | — | `string \| null` (path) | F01 |
| `files.getPathForFile(file)` | `File` | `string` (preload only, `webUtils`) | F01 drag & drop |
| `files.readBook(path)` | path | `{ bookId, data: ArrayBuffer, fileName, size, format }` or `{ error: 'not-found' \| 'unsupported' \| 'read-failed' }` | F01 |
| `files.takeOpenRequest()` | — | `string | null`: the book path File Explorer asked to open (each request returned once) | F15 |
| `files.onOpenRequested(cb)` | *event* | — (then call `takeOpenRequest`) | F15 |
| `library.list()` | — | `LibraryEntry[]` sorted by `lastOpened` desc | F04 |
| `library.upsert(entry)` | `LibraryEntry` | `void` | F01/F04/F05 |
| `library.remove(bookId)` | id | `void`: also deletes `books/<id>.json` | F04 |
| `library.locate(bookId)` | id | `{ ok: true, path } \| { ok: false, reason: 'cancelled' \| 'different-file' }` | F01.5 |
| `bookData.get(bookId)` | id | `BookData` (defaults if none) | F05/F06/F11/F12 |
| `bookData.put(bookId, data)` | id, `BookData` | `void` (queued atomic write) | same |
| `settings.get()` / `settings.set(patch)` | — / partial | `Settings` | F08, window |
| `app.systemTheme()` | — | `'day' \| 'night'` | F08 first launch |
| `win.setFullScreen(on)` | bool | `void` | F13 |
| `win.onFullScreenChange(cb)` | *event* | — | F13 |
| `shell.openExternal(url)` | https url | `void` (after confirm) | links in books |

## 5 · ReaderAdapter interface (`src/renderer/reader/ReaderAdapter.ts`)

```ts
export type Format = 'pdf' | 'epub';
export type Loc = string;              // opaque, serialisable position (see data-model.md §3)
export type Theme = 'day' | 'night';
export type HlColor = 'yellow' | 'green' | 'blue' | 'pink';

export interface BookMeta { title?: string; author?: string; hasText: boolean }   // hasText=false → scanned PDF
export interface TocItem  { label: string; target: Loc; children: TocItem[] }
export interface Progress {
  loc: Loc;              // save this for resume
  current: number;       // PDF: page (1-based) · EPUB: location (1-based)
  total: number;         // PDF: page count     · EPUB: location count
  fraction: number;      // 0..1 for library progress %
  label: string;         // "12 / 340"  or  "Location 1203 of 3410 · 37%"
  tocTarget?: Loc;       // current chapter, for TOC highlight (F10.4)
  atStart: boolean; atEnd: boolean;
}
export interface SearchHit { loc: Loc; anchor: Anchor; pre: string; match: string; post: string; label: string }
export interface Selection { anchor: Anchor; text: string; rect: DOMRect }   // rect for popup placement
export type Anchor = PdfAnchor | EpubAnchor;                                   // see data-model.md §3
export interface ViewSettings {               // per book
  pdf?:  { zoom: number | 'fit-width' | 'fit-page' };
  epub?: { fontSize: number; fontFamily: 'serif' | 'sans' };
}
export interface RenderHighlight { id: string; anchor: Anchor; color: HlColor; hasNote: boolean }

export interface ReaderAdapter {
  readonly format: Format;
  open(data: ArrayBuffer, opts?: { password?: string }): Promise<BookMeta>;  // throws PasswordRequired | WrongPassword | UnsupportedBook
  mount(container: HTMLElement): void;
  destroy(): void;

  goTo(loc: Loc): Promise<void>;
  goToNumber(n: number): Promise<void>;     // page box / location box
  next(): Promise<void>; prev(): Promise<void>; first(): Promise<void>; last(): Promise<void>;

  setView(v: ViewSettings): Promise<void>;
  setTheme(t: Theme): void;

  getToc(): Promise<TocItem[]>;
  search(query: string, signal: AbortSignal): AsyncIterable<SearchHit[]>;  // yields batches
  showSearchMatch(hit: SearchHit | null): void;                            // static outline, F09.2

  setHighlights(hls: RenderHighlight[]): void;   // full replace; adapter re-draws on every render
  clearSelection(): void;

  on(ev: 'relocate', cb: (p: Progress) => void): () => void;
  on(ev: 'select', cb: (s: Selection | null) => void): () => void;   // null = selection cleared
  on(ev: 'select-error', cb: (msg: string) => void): () => void;     // e.g. F11.4 cross-page
  on(ev: 'highlight-click', cb: (id: string, rect: DOMRect) => void): () => void;
  on(ev: 'keydown', cb: (e: KeyboardEvent) => void): () => void;     // forwarded from EPUB iframe
}
```

### PdfAdapter design
- One `<canvas>` (scaled by `devicePixelRatio`), with a `TextLayer` div and a highlight `<svg>` overlay above it. Night mode inverts **only the canvas**.
- Renders the current page and pre-renders ±1 into offscreen canvases; cancels stale `renderTask`s; calls `page.cleanup()` on pages that are dropped.
- **Page text model:** for each page, `getTextContent()` → `pageText = items.map(i => i.str + (i.hasEOL ? '\n' : '')).join('')`, with a span-offset table. This is cached per page and shared by search, selection→anchor and anchor→rects.
- Scroll inside a zoomed page; wheel at the top/bottom edge → prev/next (F02.5).

### EpubAdapter design (foliate-js)
- Creates `<foliate-view>`, `view.open(blob)`, renderer attributes `flow="paginated"`, `max-column-count="1"` (single page, F07.1), and **no animation** (do not set the `animated` attribute).
- Progress comes from the `relocate` event: `detail.location.{current,total}` (foliate-js's built-in location count, about 1,500 characters each), `detail.fraction`, `detail.cfi` and `detail.tocItem`. No slow pre-generation is needed (unlike epub.js).
- `goToNumber(n)` → `view.goToFraction((n-1)/total)`.
- Theme and font are applied with `view.renderer.setStyles(css)`, built from the design tokens.
- Search uses `view.search({ query, matchCase: false, matchDiacritics: false })`, an async generator that is converted to `SearchHit[]` batches.
- Highlights use `view.addAnnotation({ value: cfiRange, color })` together with the `draw-annotation` event → `Overlayer.highlight`; a click raises `show-annotation`.
- Selection: on each section `load`, listen to `selectionchange`/`pointerup` in `doc`, then `view.getCFI(index, range)`.
- Keyboard: forward `keydown` from each section document to the app.

## 6 · Renderer state

```
AppState { screen: 'library' | 'reader'; theme; settings; library: LibraryEntry[];
           reader?: { entry, format, progress, view, bookmarks, highlights, toc, search, sidebar } }
```
- One `useReducer` store with typed actions. A save effect sends `bookData.put` whenever `reader.{position,view,bookmarks,highlights}` changes: **immediately on page change** (F05.3, which allows the saved position to be at most one page out of date); main merges bursts in its write queue.
- Shortcuts live in one `keymap.ts` table, which matches the spec's shortcut table. It is disabled when focus is in an `<input>` or `<textarea>` (except Esc / Enter / Ctrl+Enter).

## 7 · Error mapping (spec F01)

| Condition | Detected where | User message |
|---|---|---|
| Not .pdf/.epub | renderer (drop) / main (extension + magic bytes `%PDF`, `PK`) | "Only PDF and EPUB files are supported" |
| File missing | main `readBook` → `not-found` | "File not found" + *Locate file…* / *Remove from library* |
| Corrupt | adapter `open()` throws `UnsupportedBook` | "This file could not be opened. It may be damaged." |
| DRM EPUB | `META-INF/encryption.xml` with non-font entries → `UnsupportedBook('drm')` | "This book is copy-protected (DRM) and can't be opened." |
| Password PDF | pdf.js `PasswordException` | password prompt / "Incorrect password" |
| Scanned PDF | `hasText=false` (no text items in the first 5 pages, then checked lazily) | search & selection messages (F09.4, F11.5) |
