# Build plan · v1

Status: **approved 2026-10-04**

Each slice ends with a **runnable app** and a review gate (Stage 03 step 7). Status: ⬜ todo · 🔨 doing · ✔ done.

| Slice | Features | Status |
|---|---|---|
| S0 Scaffold & shell | (foundation) | ✔ |
| S1 Open & render PDF | F01 (PDF) | ✔ |
| S2 PDF navigation & zoom | F02, F03, F07 (PDF) | ✔ |
| S3 EPUB adapter (spike first) | F01, F02, F03, F07 (EPUB) | ✔ |
| S4 Library, persistence & resume | F04, F05, F01.5 | ✔ |
| S5 Day/night & full screen | F08, F13 | ✔ |
| S6 Sidebar & table of contents | F10 | ✔ |
| S7 Bookmarks | F06 | ✔ |
| S8 Search | F09 | ✔ |
| S9 Highlights | F11 | ✔ |
| S10 Notes | F12 | ✔ |
| S11 Installer | F14 | 🔨 built; install test with the user pending |

---

### S0 · Scaffold & shell
**Touches:** `app/` (whole skeleton from the `electron-vite` react-ts template), `src/main/window.ts` (hardening §3), `src/main/menu.ts`, `src/preload/index.ts`, `src/shared/ipc.ts`, `src/renderer/ui/theme.css`, `App.tsx` (empty library screen), `package.json` scripts `dev · build · typecheck · test · test:e2e · dist`.
**Done when:**
- `npm run dev` opens a window showing the empty-library message in day colours.
- `npm run typecheck` and `npm test` pass (one trivial test); one Playwright smoke test launches the app and finds the empty-state text.
- The DevTools network tab shows that an external `fetch('https://example.com')` from the console is **blocked**.

### S1 · Open & render PDF
**Touches:** `main/files.ts` (dialog, read, magic-byte check, hash), `reader/ReaderAdapter.ts`, `reader/pdf/PdfAdapter.ts` (open, mount, render one page sharp), `ui/Dialog` (errors, password prompt), the reader screen with a toolbar stub, and `⟵ Library`.
**Done when:** F01.1–F01.4 pass for PDF (Ctrl+O, drag and drop, wrong type, corrupt file, password); page 1 renders sharply at the window size.

### S2 · PDF navigation & zoom
**Touches:** PdfAdapter (next/prev/first/last/goToNumber, ±1 pre-render, zoom steps, fit width/page, wheel-at-edge), toolbar page box and zoom controls, `app/keymap.ts`.
**Done when:** F02.1–F02.5, F03.1–F03.2 and F07.1–F07.3 pass for PDF; paging a 500-page PDF stays instant; memory does not grow when paging through 100 pages (Task Manager check).

### S3 · EPUB adapter (spike first)
**Step 1, spike (≤ ½ day):** load foliate-js in the hardened renderer (CSP, sandbox). Confirm: (a) a Gutenberg EPUB renders paginated with a single column, (b) `relocate` gives `location.current/total` and a CFI, (c) EPUB `<script>` does **not** run, (d) the iframe forwards keydown. **If any of these fail →** stop, report, and fall back to `epubjs@0.3.93` (log the decision).
**Step 2:** `reader/epub/EpubAdapter.ts` implementing navigation, `goToNumber`, text size, font family, location label; the toolbar switches to A−/A+ for EPUB; DRM detection.
**Done when:** F01.1–F01.3, F02.1/2/4, F03.3 and F07.1/2 pass for EPUB; the location label reads "Location N of M · X%".

### S4 · Library, persistence & resume
**Touches:** `main/store/*` (jsonStore with atomic write queue, library, bookData, settings), IPC handlers + zod schemas, `features/library/*` (list, ✕ remove with confirm, ⚠ missing, Locate file…), save-on-relocate, resume on open, per-book view restore, window bounds restore.
**Unit tests:** jsonStore (atomic write, corrupt-file recovery, write merging), schemas, hash identity, library sort.
**Done when:** F04.1–F04.4, F05.1–F05.3, F01.5 and F03.4 pass. **Plus a packaging smoke test:** `npm run dist` builds an installer that opens a PDF and an EPUB. This catches pdf.js worker / asar problems early; the full installer polish is in S11.

### S5 · Day/night & full screen
**Touches:** theme switch in the store and settings, `[data-theme]` on the root, PDF canvas invert (not the overlay), EPUB `setStyles`, first launch → `systemTheme`, full screen via IPC, toolbar auto-hide on top-edge hover.
**Done when:** F08.1–F08.4 and F13.1–F13.3 pass.

### S6 · Sidebar & table of contents
**Touches:** `ui/Sidebar` (4 tabs, Ctrl+\, remembers open/tab), `features/toc/*` (tree, collapse, current-chapter highlight). PdfAdapter `getToc` (outline → page via `getDestination`/`getPageIndex`); EpubAdapter `getToc` (`view.book.toc`).
**Done when:** F10.1–F10.4 pass for both formats, including a book with no TOC.

### S7 · Bookmarks
**Touches:** `features/bookmarks/*`, toolbar 🔖 state, Ctrl+B, auto label (chapter title + "p. N" or "X%").
**Done when:** F06.1–F06.4 pass for both formats.

### S8 · Search
**Touches:** PdfAdapter `search` (per-page text cache, lazy, batched, abortable, accent-insensitive with `normalize('NFD')`), EpubAdapter `search` (foliate-js generator), `showSearchMatch` outline, `features/search/*` (Ctrl+F, list, count, 500 cap, Enter/Shift+Enter).
**Unit tests:** PDF text normalisation and match → offset mapping.
**Done when:** F09.1–F09.5 pass, including the scanned PDF and the 500-page PDF timings.

### S9 · Highlights
**Touches:** adapter `select` / `setHighlights` / `highlight-click`; PDF offset↔range mapping and the SVG overlay; EPUB annotations; `ui/Popup` (colour dots · Note · Copy / Delete); `features/highlights/*` list; the anchor repair logic (data-model §3).
**Unit tests:** PDF anchor ↔ offsets round trip, repair by text, book-order sorting.
**Done when:** F11.1–F11.5 pass for both formats, including after zoom, resize and restart.

### S10 · Notes
**Touches:** note editor (in the popup), ✎ marker, hover tooltip, the note shown in the Highlights list, empty note → removed.
**Done when:** F12.1–F12.3 pass.

### S11 · Installer
**Touches:** `package.json` → `build` config (skills/windows-packaging.md), `build/icon.ico`, production menu, version 1.0.0.
**Done when:** F14.1–F14.4 pass on this PC. Hand over to Stage 04 for the full test pass.

---

## Feature → slice coverage (audit)

| F01 | F02 | F03 | F04 | F05 | F06 | F07 | F08 | F09 | F10 | F11 | F12 | F13 | F14 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 S3 S4 | S2 S3 | S2 S3 S4 | S4 | S4 | S7 | S2 S3 | S5 | S8 | S6 | S9 | S10 | S5 | S11 |

## Risks

| Risk | Mitigation |
|---|---|
| foliate-js behaves differently in a sandboxed, CSP-locked renderer | S3 spike with a clear fallback to epub.js |
| TypeScript 7 (new native compiler) incompatible with a tool | Type-check only; pin `typescript@6` if needed and log it |
| pdf.js worker not found in the packaged app | Packaging smoke test moved forward to S4 |
| Huge PDFs over IPC (100 MB+) | Accept for v1; a `book://` streaming protocol is a later optimisation |
