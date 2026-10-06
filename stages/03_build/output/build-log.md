# Build log

One entry per slice, newest first.

## 2026-10-06 · S12 · F16 OCR: engine, storage and plumbing ✔ (v1.2.0 in progress)

**What changed**
- Dependencies (dev): `tesseract.js` 7 (Apache-2.0), `@tesseract.js-data/eng` (MIT). `scripts/copy-ocr-assets.mjs` (run by `postinstall`) copies the worker, the engine `tesseract-core-simd-lstm.wasm.js` (WebAssembly embedded) and `eng.traineddata.gz` (best_int) into `public/ocr/` (6.7 MB, git-ignored like pdf.js). In the browser build the engine is one self-contained file, so no `.wasm` MIME handling was needed.
- `reader/ocr/OcrEngine.ts` (worker wrapper; all three paths set to `app://bundle/ocr/…`, `workerBlobURL: false`, no cache), `pageImage.ts` (renders a page to a bitmap, long side 2200 px), `ocrGeometry.ts` (pixel boxes → PDF points from the top-left, independent of scale and rotation). `PdfAdapter.recognisePage(n)` loads the engine lazily (its own 40 kB chunk, so normal reading never loads it) and is not yet used by the UI.
- Storage: `OcrFileSchema`/`OcrLineSchema`, `Store.getOcr/putOcrPage` (`books/<id>.ocr.json`, atomic and merged writes), removed with the book and moved on rekey; IPC `ocr.get` / `ocr.putPage` with zod validation (bad ids, page 0, empty text and malformed boxes are rejected).
- **No change to the CSP was needed** (the worker runs fine with the existing `worker-src 'self' blob:`).

**How it was checked**
| Check | Method | Result |
|---|---|---|
| typecheck | automated | ✔ |
| 12 new unit tests (storage: persist, burst, replace, delete with the book, rekey, bad ids; schema; geometry incl. rotation and scale) | automated | ✔ 65/65 |
| 3 new e2e tests: the engine reads a picture of text inside the real window (`app://`, CSP, offline blocker on) with **zero blocked requests** (with a positive control proving the blocker log is captured); pages saved over IPC survive a restart; malformed data and bad ids are refused | automated | ✔ 91/91 |
| Engine on the two synthetic test pages (clean; rough: tilted, noisy, blurred, JPEG) in the dev build **and** in the packaged `win-unpacked` app | scripted | ✔ 511/511 and 509/511 words; about 4.3–5 s per dense page; 0 blocked, 0 page errors |
| Installed size | measured | 380 → 386 MB (+6 MB) |

**Found on the way:** my first "no blocked requests" check could not fail, because the page's own CSP stops a page request before the blocker sees it, and the main-process console was not being captured. The control request (sent from the main process) caught that; the test now proves the blocker's log is visible before asserting it is empty.

**Not done yet (S13/S14):** the notice, the text layer from recognised lines, search and highlights, whole-book recognition, a scanned PDF fixture, the real scanned book (user's Forrest Mims, 128 pages, no text layer, private test only, never committed).
 night-mode text unreadable in books with their own colours → installer v1.1.1 🔍

- **B004** (found by the user with a Project Gutenberg EPUB): the book's `body { color: black }` beat the night text colour. `epub/epubStyles.ts` now sets colour and a transparent background on `body` with `!important`, and in night mode replaces all text colours in the book (links keep the accent colour). Day mode keeps the book's own colours on headings and similar.
- New fixture `styled.epub` (Gutenberg-style CSS; the generator still reproduces the old fixtures byte for byte) and an e2e test that reads real screen pixels (night: something bright; day: something dark). Confirmed to **fail without the fix**.
- Checked: full suite 88 e2e, 53 unit, type-check; real pg1661 book in both themes by screenshot. Version → **1.1.1**. Not yet tested: other publishers' EPUBs with unusual colour schemes (tables or boxes with their own light backgrounds could show light text on a light box in night mode).

## 2026-10-06 · F15 "Open with" from File Explorer → installer v1.1.0 🔍

**What changed**
- `main/openRequests.ts`: reads the book path from the command line (skips the exe, the app folder in dev, and every switch; resolves relative paths), queues it, and brings the window to the front (restores it if minimised).
- `main/index.ts`: single-instance lock; `second-instance` passes the new path to the running window. Start-up path is queued until the page asks.
- IPC: `files.takeOpenRequest()` + `files.onOpenRequested(cb)` (architecture §4). `App.tsx` opens the path through the usual `openPath`, so missing/damaged/non-book files get the usual message. The book already on screen is not reopened; `ReaderScreen` now has `key={bookId}` so another book starts a fresh reader.
- Installer: `app/build/installer.nsh` registers "Open with" for .pdf/.epub (offer only, decision 2026-10-06), and uninstall removes it. Version → **1.1.0**.

**How it was checked**
| Check | Method | Result |
|---|---|---|
| typecheck | automated | ✔ |
| 7 new unit tests (command-line parsing, launch data) | automated | ✔ 53/53 |
| 5 new e2e tests: start with a PDF/EPUB (opens directly, at the saved page), second start from the library / from another book / with the window minimised (same window, restored), same book again (page kept), missing/damaged/.txt file (message, library) | automated | ✔ 87/87 |
| Packaged `Ebook Reader.exe` started with a PDF, then a second start with an EPUB | scripted | ✔ opened directly, then switched in the same window; second process exited |
| Installer compiles with the custom registry script | `npm run dist` | ✔ `Ebook-Reader-Setup-1.1.0.exe` |
| Explorer right-click → Open with lists the app; double-click; uninstall removes it (F15.1, F15.5) | — | **not tested yet.** It needs installing on your PC, so it's the Stage 04 hand test |

**Found on the way**
- The old F05.3 test ("survives a hard kill") only killed Playwright's launcher process, so the real app kept running. The new single-instance lock exposed this. A new `hardKill` helper now kills the real app process and its helper processes, so the test really tests a crash. It still passes.

## 2026-10-06 · Fix after the user's hand test H5: B003 → installer v1.0.2

- **B003**: the mouse wheel did nothing in EPUBs. `EpubAdapter.onWheel` (on each section document and the pane margins): wheel = next/previous page with a 300 ms cool-down; Ctrl+wheel = text size. New e2e test (incl. "a fast flick turns exactly one page"); 82 e2e ×2, 46 unit; packaged 1.0.2 checked with Carnegie.

## 2026-10-06 · Fix after the user's first hand test: B002 → installer v1.0.1

- **B002**: dark frame around EPUB text in day mode (margins kept the night colour after a theme switch). Fixed via foliate's `--theme-bg-color` in `epub/epubStyles.ts`; reproduced and verified by reading the real margin pixel colour (night → day → night), in dev **and** in the packaged app; new e2e regression test. Whole suite: 81 e2e (2 full runs clean), 46 unit.
- Version → **1.0.1**; installer `app/release/Ebook-Reader-Setup-1.0.1.exe` (the 1.0.0 build was removed from `release/`).
- Slip on my side, caught and undone before commit: an `asar extract-file` check wrote the packaged `package.json` over `app/package.json`; restored from git (only the version change remains).

## 2026-10-06 · S11 Installer (built; install test with the user pending)

**What changed**
- **App icon from the user's logo** (red round "RITZco" badge, supplied in chat): `app/build/icon-source.png` → `scripts/make-icon.cjs` (`npm run icon`, runs in Electron: square crop 640×641 → 640×640, outside the circle made transparent with a soft edge, premultiplied alpha) → `app/build/icon.png` 512×512. electron-builder makes the `.ico` from it; the dev window uses the PNG.
- Version **1.0.0**; `win.icon: build/icon.png`.
- Installer: `app/release/Ebook-Reader-Setup-1.0.0.exe` (108.6 MB). The old 0.1.0 build was removed from `release/`.

**How it was checked**
| Check | Method | Result |
|---|---|---|
| Icon has transparent corners and an opaque badge | pixel check (alpha 0 / 255) + visual | ✔ |
| Windows shows the logo for `Ebook Reader.exe` and the setup `.exe` | extracted with `ExtractAssociatedIcon` (what Explorer uses) | ✔ |
| Packaged app: version 1.0.0, no menu, served from `app://`, DevTools stay closed after F12 / Ctrl+Shift+I (F14.4) | scripted against `release/win-unpacked` | ✔ |
| Packaged app works: Mims PDF opens (128 p.), highlight + note with ✎, Carnegie EPUB opens, EPUB search "criticism" → 32 results, no console errors | scripted | ✔ |
| Whole suite | 80 e2e, 46 unit, type-check | ✔ |
| **F14.1 install (folder choice, Start-menu shortcut) · F14.2 offline · F14.3 uninstall/reinstall keeps data** | — | **not done yet: needs the user (installing changes the PC)** |

## 2026-10-06 · S10 Notes on highlights ✔

**What changed**
- `features/highlights/NoteEditor.tsx`: a small note box placed next to the text; Save / Cancel, **Ctrl+Enter** saves, **Esc** cancels; plain text, 5,000-character limit (a counter appears near the limit).
- `HighlightPopup`: a **Note** button on new text (first creates a yellow highlight, then opens the editor) and on existing highlights (opens the editor with the current note). New `note` popup state.
- Saving an empty note removes the note and keeps the highlight (storage from S9: `BookSession.updateHighlight`).
- ✎ marker: PDF as a small raised mark after the last line (`PdfMarks`); EPUB drawn into foliate's overlay next to the highlight (`EpubMarks.drawHighlight`).
- Hover tooltip with the note: PDF by hit-testing the highlight boxes (the marks layer can't take the mouse, since the text layer above must stay selectable); EPUB by hit-testing the rectangles foliate draws, with the note set as the section document's `title`.
- `RenderHighlight` now carries the note text.

**How it was checked**
| Criterion | Method | Result |
|---|---|---|
| F12.1 Note on new text → yellow highlight + note + ✎ + list entry; Note on an existing highlight; Esc cancels without saving | automated e2e (PDF) | ✔ |
| Hover tooltip shows the note (and goes away off the highlight) | automated e2e (PDF + EPUB) | ✔ |
| F12.2 edit a note; saving it empty removes the note, keeps the highlight | automated e2e | ✔ |
| F12.3 notes survive a restart (PDF + EPUB; EPUB note edited after restart) | automated e2e | ✔ |
| ✎ placement; editor look; Carnegie EPUB at night | screenshots | ✔ after one fix (below) |
| Whole suite | 80 e2e (2 full runs clean), 46 unit, type-check | ✔ |
| Using it by hand | — | **not done by me** |

**Found and fixed**
- The first EPUB ✎ sat on the text line and covered the start of the next word → now small and raised like a footnote mark (PDF the same).

**Notes**
- Clicking back into the page while the note box is open closes it without saving (the same as Cancel), like other pop-up boxes.

## 2026-10-05 · S9 Highlights ✔

**Refactor first (as planned in S8):** marks and selection moved out of the adapters. `pdf/PdfMarks.ts` + `pdf/PageCanvases.ts` (PDF adapter 373 → 324 lines); `epub/EpubMarks.ts`, `epub/helpers.ts`, `epub/epubStyles.ts` (EPUB adapter 346 → 281). The full suite (67 e2e) passed unchanged after the refactor, before any S9 code was added.

**What changed**
- `ReaderAdapter`: `setHighlights()`, `clearSelection()`, `describe(anchor)`; events `select`, `select-error`, `highlight-click`, `highlight-repaired`, `highlight-missing`.
- PDF: selections in pdf.js's text layer → page-text offsets (`PageLayers.offsetOf`); highlights drawn as boxes in the marks layer, blended (`multiply` by day, `screen` by night) so the text stays readable; click hit-testing; **re-finding moved text** (`pdf/anchors.ts`, unit-tested) → saved repaired anchors, or "⚠ couldn't find on page".
- EPUB: selections → CFI ranges (`view.getCFI`); highlights through foliate's overlay (`Overlayer.highlight`, colour + blend via CSS variables); clicks via foliate's `show-annotation`; marks re-added when a section reloads and on theme change.
- UI: `features/highlights` (`useHighlights`, `SelectionPopup` with 4 colour dots + Copy / Delete, `HighlightPopup`, `HighlightList` in book order with colour bar, quote, page/chapter). **Highlights** sidebar tab. Copy goes through main (`clipboard:writeText`), because the renderer's clipboard permission is denied.
- `data-ready` on the reader: the book is on screen and accepts input (used by the tests).

**How it was checked**
| Criterion | Method | Result |
|---|---|---|
| F11.1 select → popup → colour → highlighted + listed (PDF, EPUB) | automated e2e (real mouse drags) | ✔ |
| F11.2 PDF: the box still covers the same words after zoom ×3, resize and restart | automated e2e (geometry within 3 px) | ✔ |
| F11.2 EPUB: still on the same words after A+ re-flow and restart | automated e2e (clicking the words opens *that* highlight) | ✔ |
| F11.3 click a highlight → recolour; Delete removes it from page and list | automated e2e | ✔ |
| Copy → clipboard | automated e2e | ✔ |
| F11.4 a selection running off the page → "Select text on one page at a time" | automated e2e | ✔ |
| F11.5 page without text → no popup | automated e2e (`no-text.pdf`) | ✔ |
| Moved PDF text re-found / missing | unit (4) | ✔ |
| Day/night colours, multi-line EPUB highlight in Carnegie | screenshots | ✔ |
| Whole suite | 75 e2e (2 full runs clean), 46 unit, type-check | ✔ |
| Using it by hand | — | **not done by me** |

**Bugs found and fixed during this slice**
- **EPUB highlights were drawn before foliate's renderer existed** → crash in foliate (`getContents` of undefined) → draw only after `view.open()`, plus a guard.
- **Sidebar tabs overflowed:** with 4 tabs the "Search" tab spilled under the reading pane and couldn't be clicked → tabs share the width (full labels), sidebar clips; new test.
- The popup closed on *any* relocate event; now only on a real position change.
- **Test race (important):** tests waited for the "Opening…" overlay to be gone *before it had even appeared*, then clicked while the book was still opening. Diagnosed with event tracing (8 reopen probes, then 0/8 failures after the fix). All tests now wait for `data-ready`. This is the likely cause of the old intermittent **B001** too.

## 2026-10-05 · S8 Search ✔

**What changed**
- `ReaderAdapter`: `search(query, signal)` (async batches), `showSearchMatch(hit)`, `hasText()`; `SearchHit` carries an `Anchor` (same shape highlights will use).
- PDF: `pdf/pageText.ts` (page text model; case-, accent- and whitespace-insensitive matching mapped back to exact offsets; snippets; unit-tested), `pdf/PdfTextStore.ts` (cached per-page text, streaming search in page order, "any text at all?"), `pdf/PageLayers.ts` (**pdf.js text layer** over the canvas plus a marks layer; offsets → DOM range → boxes). The text layer also makes PDF text selectable, ready for S9.
- EPUB: `epub/epubSearch.ts` uses foliate's matcher + `getCFI` directly (foliate's own `view.search()` would outline *every* match in red); results are labelled by chapter; the chosen match is outlined through foliate's annotation overlay in the accent colour and redrawn when its section reloads.
- UI: `features/search` (`useSearch`: streaming, 500 cap, abort, active result, Enter/Shift+Enter; `SearchPanel`: box, status line, results with the match in bold + "p. N"/chapter). Ctrl+F and 🔍 open the Search tab with the cursor in the box; results stay when switching tabs; clearing the box cancels.
- Fixtures: accented text in `sample-3p.pdf` (WinAnsi font) and `sample.epub`; new `no-text.pdf` (pages without any text).

**How it was checked**
| Criterion | Method | Result |
|---|---|---|
| F09.1 Ctrl+F / 🔍 opens Search, cursor in box; result list with count, snippet, bold match, page | automated e2e | ✔ |
| Case- and accent-insensitive ("creme BRULEE" → "crème brûlée", "cafe" → "CAFÉ") | automated e2e (PDF + EPUB) + unit | ✔ |
| F09.2 click → jumps and outlines the match on the page; Enter / Shift+Enter step (wrapping) | automated e2e (PDF); EPUB jump automated, EPUB outline **by screenshot** (it lives in foliate's closed shadow DOM) | ✔ |
| F09.3 "No results for '…'"; fewer than 2 characters → hint | automated e2e | ✔ |
| F09.4 PDF without text → "no searchable text (it may be scanned)" | automated e2e (`no-text.pdf`) + scripted on the **real Mims PDF** (92 ms) | ✔ |
| F09.5 500-page PDF: first results **64 ms**; longest frame gap while searching **50 ms** (no freezing); capped "Showing first 500 results"; clearing cancels | automated e2e | ✔ |
| EPUB: 120 hits across 3 chapters labelled by chapter; Carnegie "criticism" → 32 results, jump + outline | automated e2e + scripted/screenshot | ✔ |
| Night mode: the PDF outline stays blue (only the canvas is inverted) | screenshot | ✔ |
| Whole suite | 67 e2e (2 full runs clean), 42 unit, type-check | ✔ |
| Using it by hand | — | **not done by me** |

**Notes**
- The search screenshot script timed out once (step unknown) and then passed 3 times in a row with step logging; most likely it started while the previous test run's Electron was still closing. Not seen in the e2e suite.
- `PdfAdapter.ts` (363 lines) and `EpubAdapter.ts` (346) are over the ~300-line guideline → split them at the start of S9, before highlights add more.

## 2026-10-05 · S7 Bookmarks ✔

**What changed**
- `ReaderAdapter`: `bookmarkLoc()`, `containsLoc()`, `compareLocs()`. PDF uses page numbers; EPUB uses the start CFI of the screen, and "is it on this screen" = start ≤ bookmark < end of the visible range (`reader/epub/locs.ts`, built on foliate's `epubcfi.js`).
- `BookSession`: bookmarks saved with the book's reading data (`bm_<uuid>` ids).
- `features/bookmarks`: `useBookmarks` (sorted list, on-this-screen state, toggle, delete) and `BookmarkList` (book order; label = chapter + "p. N" / "X%"; date; 🗑; empty message).
- Toolbar ☆/★ button (`aria-pressed`) + **Ctrl+B** (also from inside EPUB text). **Bookmarks** tab in the sidebar; clicking jumps and returns the keyboard to the page.
- `formatDate` moved to `ui/` (shared by the library and bookmarks).

**How it was checked**
| Criterion | Method | Result |
|---|---|---|
| F06.1 Ctrl+B / ☆ adds (button filled, listed), again removes (PDF + EPUB, incl. focus inside EPUB text) | automated e2e | ✔ |
| Button state follows paging (on/off the bookmarked screen) | automated e2e (PDF + EPUB) | ✔ |
| F06.2 list in **book order** (not creation order) with chapter labels; click jumps | automated e2e | ✔ |
| F06.3 bookmarks survive a restart (PDF + EPUB); the Bookmarks tab is remembered | automated e2e | ✔ |
| 🗑 deletes; F06.4 empty message | automated e2e | ✔ |
| CFI helpers: start, contains (start inclusive, end exclusive), order, garbage-safe | unit (4) | ✔ |
| Carnegie EPUB: two bookmarks in PART ONE, list + ★ state | scripted + screenshot | ✔ |
| Whole suite | 60 e2e (2 full runs clean), 35 unit, type-check | ✔ |
| Using it by hand | — | **not done by me** |

**Notes**
- In books with long chapters (Carnegie's TOC is flat), labels like "PART ONE … · 11%" and "· 12%" look alike. That's the automatic label agreed in spec Q6; logged as later idea L06 (add the first words of the page).

## 2026-10-05 · S6 Sidebar & table of contents ✔

**What changed**
- `ReaderAdapter.getToc()` + `TocItem` (stable ids like "1.0") + `Progress.tocId` (current chapter).
- PDF (`reader/pdf/pdfToc.ts`): outline → tree; explicit **and named** destinations → `pdf:p=N`; entries without a destination are shown but not clickable; current chapter = the deepest entry starting on or before the current page.
- EPUB: `view.book.toc` → tree; current chapter from foliate's `relocate.tocItem` (by href; the deeper entry wins when a part and its first chapter share a link).
- `ui/Sidebar` (tabbed; only **Contents** for now; Bookmarks, Highlights and Search are added in S7–S9) and `features/toc/TocTree` (nested, ▸/▾ collapse, current chapter highlighted and kept in view, "This book has no table of contents.").
- ☰ button + Ctrl+\ toggle the sidebar; open/closed and the active tab are remembered. The state is loaded at start-up, so the pane never resizes after a book is laid out. Hidden in full screen.
- Clicking an entry jumps there and gives keyboard focus back to the page.
- Fixtures: `toc.pdf` (6 pages, nested outline, one named destination), `no-toc.epub`.

**How it was checked**
| Criterion | Method | Result |
|---|---|---|
| F10.1 PDF outline as a nested tree in order; EPUB contents listed | automated e2e | ✔ |
| F10.2 clicking jumps (explicit + named PDF destinations, EPUB chapter); ← → keep working afterwards | automated e2e | ✔ |
| Collapse / expand nested levels | automated e2e | ✔ |
| F10.3 "This book has no table of contents." for a PDF without an outline and an EPUB with an empty nav | automated e2e | ✔ |
| F10.4 highlight follows paging (PDF pages 1→2→3→End; EPUB jump + Home) | automated e2e + unit (current-chapter rule) | ✔ |
| Sidebar toggle (☰, Ctrl+\), remembered after restart, hidden in full screen | automated e2e | ✔ |
| Carnegie EPUB: 12 contents entries (the book's TOC is flat), jump to "PART ONE" → location 39, highlighted | scripted + screenshot | ✔ |
| Whole suite | 56 e2e (2 full runs clean), 31 unit, type-check | ✔ |
| Using it by hand | — | **not done by me** |

**Issues found and fixed**
- `smoke.spec.ts` (written in S0) still launched the app **without an isolated data folder**, so it read the user's real library (and on close would have saved the test window's size into the real `settings.json`; no books or reading data were touched). It failed once the user's library had books → now uses the isolated launcher like all other tests.
- `PdfAdapter.ts` grew past the size guideline → TOC logic moved to `pdfToc.ts`.

## 2026-10-05 · S5 Day/night & full screen ✔

**What changed**
- Theme: ☀/☾ button in both toolbars + Ctrl+Shift+N; global, saved in settings; first launch follows Windows. Applied **before the first paint** (`main.tsx` waits for it) and the window's background colour matches, so there is no flash.
- Main sets `nativeTheme.themeSource` from the app theme, so scrollbars, native controls and `prefers-color-scheme` (used inside foliate) follow the app, not Windows.
- `ReaderAdapter.setTheme()`: PDF inverts **only the page canvas** (`invert(1) hue-rotate(180deg)`), leaving room for later overlays (highlights) to stay un-inverted; EPUB rebuilds its book styles from the new tokens.
- Full screen: F11 / ⛶ / Esc via **main** (`win.setFullScreen` + enter/leave events to the page). The toolbar floats over the page and appears when the mouse touches the top edge (no re-layout). The EPUB status bar is hidden in full screen. Leaving the book leaves full screen.
- `button.primary` text now uses `--surface` (readable on the light-blue night accent; no hard-coded white).

**How it was checked**
| Criterion | Method | Result |
|---|---|---|
| First launch follows the Windows setting | automated e2e | ✔ |
| F08.1 button + Ctrl+Shift+N switch toolbar/library/body colours at once; Electron's native theme follows | automated e2e (computed colours) | ✔ |
| F08.2 PDF canvas inverted in night mode (switching while reading **and** opening while already night); stays inverted on later pages | automated e2e + screenshot of Mims PDF | ✔ |
| F08.3 EPUB html colour/background = night ink/page; back to day immediately | automated e2e + screenshot of Carnegie | ✔ |
| F08.4 theme remembered after restart (opposite of the Windows setting) | automated e2e | ✔ |
| F13.1 F11 / ⛶ → window full screen, toolbar hidden · F13.2 Esc / F11 leave | automated e2e | ✔ |
| Toolbar appears at the top edge and hides again | automated e2e | ✔ |
| F13.3 paging, End, theme toggle work in full screen; leaving the book exits full screen | automated e2e | ✔ |
| Whole suite | 49 e2e (2 full runs clean), 29 unit, type-check | ✔ |
| Using it by hand | — | **not done by me.** Please try it |

**Bugs found and fixed during this slice**
- **A PDF opened while night mode was already on stayed white**: `mount()` reset the page element's class, wiping the night flag. Found from the screenshot (the test only covered switching while reading) → fixed + new test.
- White text on the light-blue night "Open book…" button was hard to read → token-based text colour.
- The browser Fullscreen API (`requestFullscreen`) hangs under Electron/Playwright here → switched to main-process full screen as the architecture originally planned (see decisions log).

## 2026-10-05 · S4 Library, persistence & resume ✔

**What changed**
- `shared/schemas.ts`: zod schemas for library, per-book data (position, view, bookmarks, highlights), settings; types derived from them.
- `main/store/jsonFile.ts`: one JSON file, loaded once and served from memory (no lost concurrent updates), **atomic writes** (temp file + fsync + rename, retries on Windows locks), burst writes merged, corrupt files renamed to `*.corrupt-<time>.json`.
- `main/store/store.ts`: `settings.json`, `library.json`, `books/<bookId>.json` under the app data folder; book ids must be 64-hex (no path tricks); remove / rekey; `flushAll()`.
- IPC: `library.list/upsert/remove/locate/rekey`, `bookData.get/put`, `settings.get/set`; every argument validated with zod in main.
- Main: waits for all writes before quitting; window size/position/maximised saved on close **and** on quit, restored only if still on a connected screen; `EBOOK_READER_USER_DATA` env var gives tests their own data folder.
- Renderer: `BookSession` (library entry, last position, zoom/text size per book; saves on every page change); adapters take a start position in `mount()` (no flash of page 1); library screen with title/author/type/last opened/progress, ✕ remove with confirmation, ⚠ missing file → *Locate file…* / *Remove from library* (+ "different file, use anyway?" re-key); Dialog gained a secondary button and a danger style.
- **Packaging:** electron-builder 26 → `Ebook-Reader-Setup-0.1.0.exe` (NSIS, 114 MB; app code 12.6 MB, the rest is Electron). Renderer-only libraries moved to devDependencies (Vite bundles them), so only `zod` is packed as a runtime dependency.

**How it was checked**
| Criterion | Method | Result |
|---|---|---|
| F04.1 new books at the top; title, author, type, "Today hh:mm", progress; click opens | automated e2e | ✔ |
| F04.2 ✕ asks first (Cancel keeps it); Remove deletes entry + reading data; **book file untouched** | automated e2e | ✔ |
| F04.3 renamed/moved file = same single entry, same position | automated e2e | ✔ |
| F04.4 empty state | automated e2e | ✔ |
| F05.1 PDF reopens at page 87 after an app restart | automated e2e | ✔ |
| F05.2 EPUB reopens at the same passage after restart **with a different window size** | automated e2e (same paragraph visible, ±4 %) | ✔ |
| F05.3 position survives a hard kill (SIGKILL) | automated e2e | ✔ |
| F01.5 missing file → File not found → Locate file… reconnects position; Remove from library works | automated e2e | ✔ |
| F03.4 zoom (PDF fit width) and text size (EPUB 20 px) restored per book | automated e2e | ✔ |
| Window size and position remembered | automated e2e | ✔ |
| Storage unit tests: defaults, atomic write, burst merge, corrupt file, invalid data, newest-first, concurrent updates, remove, rekey, id validation | automated (12) | ✔ |
| **Packaging smoke:** packaged `Ebook Reader.exe` opens the real Mims PDF (renders, pages) and Carnegie EPUB; library fills; no console errors; runs from `app://` | scripted against `release/win-unpacked` | ✔ |
| Installing with the .exe on Windows | — | **not done.** That's a hand test in S11 (installing changes the PC) |
| Whole suite | 40 e2e, 29 unit, type-check | ✔. 6 full runs: 5 clean; **1 run had one intermittent failure** ("Remove from library is offered for a missing file", a 10 s wait for page 1); not reproducible in 6 isolated repeats + 2 full runs. Left open in the bug list, not hidden with retries |

**Bugs found and fixed during this slice**
- Window bounds were saved *after* the final flush on quit, so they were lost → saved at the start of quitting too.
- foliate reports a `NaN` progress fraction while measuring → guarded (main's validation had rejected it, so nothing bad was stored).

**Known gaps / notes**
- The app data folder is shared by `npm run dev` and the installed app (`%APPDATA%\Ebook Reader`), so your dev-mode library will appear in the installed app.
- SmartScreen will warn about the unsigned installer (expected; S11).

## 2026-10-04 · S3 EPUB adapter ✔

**Trial (step 1): passed; foliate-js kept.** See the decisions log. The checks were scripted in the production build with the generated `sample.epub` and the user's Carnegie EPUB.

**What changed**
- `reader/epub/EpubAdapter.ts` (foliate-js): open/parse, single-column paginated layout, Location N of M · %, next/prev/first/last, location box, text size 14–28 px (A−/A+, Ctrl ±, Ctrl+0 = 18 px), Serif/Sans, styles from design tokens, key and drop forwarding from the book iframes, navigation queue (no lost quick presses), "settled" wait after init.
- `reader/epub/drm.ts`: DRM detection from `META-INF/encryption.xml`; font obfuscation is allowed.
- `reader/epub/foliate.d.ts`: narrow types for the parts of foliate-js we use.
- `ReaderAdapter`: `mount()` is now async (resolves when the first page is on screen); `ViewState`/`ViewSettings` cover both formats.
- Toolbar: EPUB shows the location box and A− · size · A+ · Serif/Sans; a status bar at the bottom shows "Location N of M · X%" (always rendered so the layout never shifts).
- `ReaderScreen` picks the adapter by format; the "Opening…" overlay now covers the pane until ready; DRM message.
- Security: CSP `style-src` + `blob:`; main blocks sub-frame navigation except blob:/about:blank.
- Fixtures: `sample.epub` (3 chapters, nav TOC, a **planted `<script>` and an internet image** in chapter 2), `font-obfuscated.epub`, `drm.epub`, `corrupt.epub` (generated, our own text).

**How it was checked**
| Criterion | Method | Result |
|---|---|---|
| F01.1 EPUB opens < 3 s with title + location label | automated e2e | ✔ (sample about 0.2 s; Carnegie 0.1 s, scripted) |
| F01.3 DRM EPUB → copy-protection message; corrupt EPUB → damaged message | automated e2e | ✔ |
| Font obfuscation is not mistaken for DRM | automated e2e | ✔ |
| F02.1 →/←/PgDn/PgUp/▶, **also with focus inside the book text** | automated e2e (real mouse click in the page) | ✔ |
| F02.2 no wrap-around, ◀/▶ disabled at the ends · F02.4 Home/End | automated e2e | ✔ |
| Location box jumps to a location | automated e2e | ✔ |
| F03.3 A+ → 20 px, reflows, same position (± one screen); Ctrl −, Ctrl+0, Serif/Sans | automated e2e | ✔ |
| F07.1 single column (`max-column-count=1`) · F07.2 no `animated`, no transitions inside the book | automated e2e | ✔ |
| EPUB script does not run; internet image refused by CSP, no response | automated e2e | ✔ |
| Carnegie EPUB: opens, 366 locations, paging, A+ | scripted + screenshot | ✔ |
| Whole suite stability | 30 e2e tests; ran repeatedly | ✔ after fixing two **test** races (zoom loop, frame swap); PDF suite 3/3 green |
| Paging an EPUB by hand | — | **not done by me.** Please try it |

**Bugs found and fixed during this slice**
- The book's own CSS was blocked by CSP → added `blob:` to `style-src`.
- First key press right after opening an EPUB was lost (foliate re-lays out after init; the status bar appeared late and resized the pane) → status bar always present + wait for layout to settle.
- Quick double presses lost a page (foliate's 100 ms lock) → navigation queue.

**Known gaps / notes**
- Text size and font aren't remembered per book yet (F03.4 → S4).
- Links to websites inside books do nothing (by design for v1).
- Chromium logs a console *warning* about the iframe sandbox; it's harmless (the CSP blocks scripts) and comes from foliate-js.

## 2026-10-04 · S2 PDF navigation & zoom ✔

**What changed**
- `ReaderAdapter` grew `goTo`, `goToNumber`, `next/prev/first/last`, `isAtEdge`, `setView`, `zoomIn/zoomOut` and a `view` event (zoom mode + effective %).
- `PdfAdapter`: zoom modes (`fit-page` default, `fit-width`, fixed steps 50–400 % at real size 96/72); **pre-renders the pages either side of the current one** so turning a page is instant; keeps only the current page ±1 drawn and calls `page.cleanup()` on the others (flat memory); zoom and resize keep the visual centre; wheel at the top/bottom edge turns the page (with a 300 ms cool-down so one flick can't skip pages); Ctrl+wheel zooms.
- `reader/pdf/zoom.ts`: pure zoom maths (unit-tested).
- `app/keymap.ts`: one table for all shortcuts in the spec (open, library, next/prev incl. Space/Shift+Space, Home/End, Ctrl+G, Ctrl +/−/0, ↑/↓ scroll-then-turn); ignored while typing in a field.
- `features/reader/ReaderToolbar.tsx`: ◀ [page box] / N ▶ (disabled at the ends), − % +, ⇔ fit width, ▣ fit page (pressed state shown).
- Pane scrolls when zoomed (`scrollbar-gutter: stable` prevents re-fit flicker; `margin:auto` centring never clips the page).
- Chromium's own page zoom is disabled (`setVisualZoomLevelLimits(1,1)`), so Ctrl+wheel only zooms the book.
- New fixture `large-500p.pdf` (500 text pages, generated).

**How it was checked**
| Criterion | Method | Result |
|---|---|---|
| F02.1 →/PgDn/▶/Space forward; ←/PgUp/◀/Shift+Space back | automated e2e | ✔ |
| F02.2 no wrap-around; ◀/▶ disabled at the ends | automated e2e | ✔ |
| F02.3 page box jumps; `0`, `abc`, `501`, `-3`, `2.5` reset; Ctrl+G focuses it | automated e2e (500-page PDF) | ✔ |
| F02.4 Home / End | automated e2e | ✔ |
| F02.5 zoomed page scrolls with the wheel; one more wheel at the bottom → next page, shown from the top | automated e2e | ✔ |
| F03.1 Ctrl +/− through 50→67→75→90→100→110 %, canvas stays sharp (backing = CSS × DPR); Ctrl+wheel; Ctrl+0 = fit page | automated e2e | ✔ |
| F03.2 fit width keeps fitting after window resizes (900 px and 1400 px) | automated e2e | ✔ |
| F07.1 one page only · F07.3 centred horizontally | automated e2e | ✔ |
| F07.2 no transition/animation on any element | automated e2e (computed styles) | ✔ |
| 500-page PDF: paging stays instant | automated e2e | ✔ average **68 ms** per page turn |
| Memory stays flat while paging (real 13 MB Mims PDF) | scripted, `app.getAppMetrics()` | ✔ 2 full passes over 128 pages: total 562 → 735 MB after the first pass (GPU cache warming), then **flat** (735 → 739 → 724 MB); JS heap constant at 18–19 MB. Page turn median 57 ms, max 169 ms |
| Unit: zoom maths (5), keymap (3), plus earlier (9) | automated | ✔ 17/17 |
| Paging/zooming by hand with mouse and keyboard | — | **not done by me.** Please try it in `npm run dev` |

**Known gaps / notes**
- Zoom and fit mode are not remembered per book yet (F03.4 → S4).
- Switching zoom keeps the current centre of the page in view (like most PDF viewers), so after "Fit width" you may land mid-page.
- EPUB parts of F02/F03/F07 → S3.

## 2026-10-04 · S1 Open & render PDF ✔

**What changed**
- `main/files.ts`: Open dialog (PDF/EPUB filters); `readBook` reads the file **read-only**, detects the format from its content (`main/sniff.ts`) and identifies it by SHA-256.
- `main/ipc.ts`: `files:openDialog` and `files:readBook`; the path is validated with zod and must end in .pdf/.epub.
- **New: `main/protocol.ts`.** The production UI is now served from `app://bundle/` instead of `file://`. pdf.js needs a real origin for its module worker and for `fetch()` of fonts/wasm. This also follows Electron's security recommendation, and the request is checked against path traversal. (See decisions log.)
- `preload`: `files.*` plus `getPathForFile` for drag & drop.
- `reader/ReaderAdapter.ts` (S1 subset: open/mount/destroy/relocate, `ReaderError`) + `reader/pdf/PdfAdapter.ts`: sharp rendering at devicePixelRatio, drawn off-screen then swapped (never shows a half-drawn page), re-fits on resize, cancels stale renders, maps PasswordException/InvalidPDF to `ReaderError`. Title comes from PDF metadata, falling back to the file name.
- pdf.js assets (fonts, CMaps, ICC, wasm) are copied locally by `scripts/copy-pdfjs-assets.mjs` (runs on `npm install`). No CDN, so it works offline.
- UI: `ui/Dialog` (errors, password prompt; Enter/Esc), `features/reader/ReaderScreen` (toolbar with ⟵ Library, title, "1 / N"), `app/openBook.ts` (all error → message mapping), `App` reducer with Ctrl+O and window-wide drag & drop.
- EPUB files currently show "EPUB support is not ready yet" (a temporary message until S3).
- Test fixtures generated by `tests/fixtures/make-fixtures.mjs` (our own content, no copyright): `sample-3p.pdf`, `protected.pdf` (password `test`, RC4), `corrupt.pdf`, `not-a-book.txt`.

**How it was checked**
| Criterion | Method | Result |
|---|---|---|
| F01.1 Ctrl+O opens a PDF, page 1 within 3 s, sharp, actually drawn | automated e2e (canvas pixel check + backing-store size) | ✔ |
| F01.1 with the real 13 MB / 128-page Mims PDF | scripted launch of the production build + screenshot | ✔ 0.9 s, renders correctly |
| F01.2 dropping a non-book file → message, nothing changes | automated e2e (synthetic drop event) | ✔ |
| F01.2 choosing a non-book file → same message | automated e2e | ✔ |
| F01.2 dropping a real PDF from Explorer | **by hand (user)**, dev build, Mims PDF | ✔ (2026-10-04) |
| F01.3 corrupt PDF → plain error, back to library, no crash | automated e2e | ✔ |
| F01.4 password prompt; wrong → "Incorrect password", retry; right → opens; Esc cancels | automated e2e | ✔ |
| ⟵ Library returns to the start screen | automated e2e | ✔ |
| No console errors in production or dev mode; no blocked requests | e2e + scripted dev launch | ✔ |
| Unit: format sniffing (5), URL allow-list (4) | automated | ✔ 9/9 |
| Type-check (node, web, e2e configs) | automated | ✔ |

**Known gaps / notes**
- The Mims test PDF is **scanned images with no text layer**. It will be the test case for F09.4 / F11.5 later.
- F01.3 for DRM-protected EPUBs belongs to S3.
- The same file opened twice simply reopens it; the library/resume behaviour arrives in S4.

## 2026-10-04 · S0 Scaffold & shell ✔

**What changed**
- New Electron + electron-vite 5 + Vite 7 + React 19 + TypeScript 7 project in `app/`, laid out as in `_config/coding-conventions.md` (`src/main`, `src/preload`, `src/shared`, `src/renderer/{app,ui,features}`).
- `main/window.ts`: hardened window (`contextIsolation`, `sandbox`, no `nodeIntegration`, DevTools only in dev, navigation and new windows blocked, permission requests denied).
- `main/security.ts`: **offline enforcement.** Every request whose scheme is not local is cancelled (the dev server is allowed only in dev).
- `main/menu.ts`: no menu in production; a small Dev menu in development.
- IPC pattern set up in `shared/ipc.ts`, with one call (`app.systemTheme`) used to prove the bridge works end to end.
- `ui/theme.css`: all design tokens for day and night, `[data-theme]` switch, and a global "no animations/transitions" rule.
- Library screen with the spec's empty-state text. *Open book…* is present but disabled until S1.
- Scripts: `dev`, `build`, `start`, `typecheck`, `test`, `test:e2e`. (`dist` is added in S4 with electron-builder.)
- Strict CSP in `index.html`.

**How it was checked**
| Check | Method | Result |
|---|---|---|
| `npm run typecheck` (TS 7) | automated | ✔ pass |
| `npm test`: 4 unit tests for the URL allow-list | automated | ✔ pass |
| `npm run test:e2e`: app starts on the empty library; `window.api` works; no `require`/`process` in the renderer; `fetch('https://example.com')` is **blocked** | automated (Playwright + Electron) | ✔ 3/3 pass |
| `npm run dev` with the strict CSP: no console errors or warnings; screenshots in day and night colours look right | scripted launch + visual check of screenshots | ✔ |
| Clicking around by hand in the window | — | **not done.** There is nothing interactive yet |

**Known gaps / notes**
- The renderer bundle is unminified (about 640 kB; this is electron-vite's default). That's fine for a local app; it can be turned on in S11 if the installer size matters.
- The theme is not persisted or toggleable yet (S5). Night mode was checked by setting `data-theme` manually.
