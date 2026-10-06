# Ebook Reader · v1 Spec

Status: **approved 2026-10-04** (Q5, Q6 defaults accepted) · **F15 added and approved 2026-10-06** (Q7: offer only) · **F16 (OCR) drafted 2026-10-06, awaiting approval (Q8–Q11)** · 2026-10-04 · Source: `shared/feature-register.md` (F01–F14)

Conventions used below:
- **Book** = an opened PDF or EPUB file. **Position** = where the reader is in a book (PDF: page number; EPUB: a CFI location).
- **Page (EPUB)** = one screen of text. Its count changes with window size and text size, so EPUB progress is shown as **"Location N of M · 37%"** (decided in Q1).
- Acceptance criteria use **Given / When / Then**. "Both" means the criterion must pass for PDF and EPUB.

---

## Screens

### Library screen (start screen)

```
┌ Toolbar: Ebook Reader                                    [Open book…]  [☀/☾] ┐
├──────────────────────────────────────────────────────────────────────────────┤
│  Title                         Author          Type   Last opened   Progress │
│  ────────────────────────────────────────────────────────────────────────    │
│  Pride and Prejudice           Jane Austen     EPUB   Today 09:12     37%  ✕ │
│  Annual Report 2025            —               PDF    Yesterday       12%  ✕ │
│  ⚠ Old Notes (file not found)  —               PDF    3 Sep 2026       5%  ✕ │
│                                                                              │
│  Empty state: "No books yet. Click Open book… or drag a PDF/EPUB here."      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Reading screen

```
┌ [☰] [⟵ Library]  Pride and Prejudice ....... [◀] [ 12 ] / 340 [▶]  [−] 100% [+] [⇔] [▣]  [🔍] [🔖] [☀/☾] [⛶] ┐
├ Sidebar (280px, toggle ☰) ┬ Reading pane ──────────────────────────────────────────────────────────────┤
│ [Contents][Bookmarks]     │                    ┌──────────────────────┐                               │
│ [Highlights][Search]      │                    │                      │                               │
│                           │                    │    one page only     │                               │
│ (tab content list)        │                    │                      │                               │
│                           │                    └──────────────────────┘                               │
└───────────────────────────┴──────────────────────────────────────────── status: Location 1203 of 3410 · 37% ┘
```

- PDF toolbar: `[−] 100% [+] [⇔ fit width] [▣ fit page]`. EPUB toolbar shows `[A−] 18px [A+] [Serif/Sans]` instead.
- 🔖 is filled when the current page is bookmarked.
- In full screen, the toolbar and sidebar are hidden; moving the mouse to the top edge shows the toolbar.

---

## Features

### F01 · Open a book
**User does:** clicks *Open book…* (or Ctrl+O), drags a file onto the window, or clicks a title in the library.
**User sees:** the reading screen at the book's saved position (or page 1 the first time).
**Edge cases:** unsupported file type; corrupt file; password-protected PDF; DRM-protected EPUB; the library entry's file has been moved or deleted; the same file opened twice; a very large file.

| # | Acceptance criterion | Scope |
|---|---|---|
| F01.1 | Given the library, when I press Ctrl+O and choose a `.pdf` or `.epub`, then the book opens on the reading screen within 3 s for a typical (< 20 MB) file. | Both |
| F01.2 | Given any screen, when I drag a `.pdf`/`.epub` file onto the window, then it opens. When I drop any other file type, then I see "Only PDF and EPUB files are supported" and nothing else changes. | Both |
| F01.3 | Given a corrupt or DRM-protected file, when I open it, then I see a plain-language error and return to the library; the app does not crash. | Both |
| F01.4 | Given a password-protected PDF, when I open it, then I'm asked for the password; a wrong password shows "Incorrect password" and lets me retry or cancel. The password is never saved. | PDF |
| F01.5 | Given a library entry whose file was moved or deleted, when I click it, then I see "File not found" with buttons *Locate file…* and *Remove from library*; locating the file reconnects all its bookmarks/highlights. | Both |

### F02 · Page navigation
**User does:** uses ◀/▶ buttons, ←/→, PgUp/PgDn, Space/Shift+Space, Home/End, mouse wheel, or types a number in the page box.
**User sees:** the page changes instantly (no animation); the page box and status bar update.
**PDF vs EPUB:** PDF uses real page numbers. EPUB's page box accepts a **location number**; ◀/▶ move one screen.

| # | Acceptance criterion | Scope |
|---|---|---|
| F02.1 | Given a book open at page 5, when I press → (or PgDn, or click ▶), then page 6 shows; ← goes back to 5. | Both |
| F02.2 | Given the last page, when I press →, then nothing happens (no wrap-around, no error). Same for ← on the first page. | Both |
| F02.3 | Given a PDF, when I type `120` in the page box and press Enter, then page 120 shows. If I type `0`, `abc` or a number > page count, the box resets to the current page. | PDF |
| F02.4 | Given a book, when I press Home / End, then the first / last page shows. | Both |
| F02.5 | Given a PDF page taller than the window (zoomed in), when I scroll the mouse wheel, then the page scrolls; at the bottom edge, one more scroll goes to the next page. | PDF |

### F03 · Zoom (PDF) · Text size (EPUB)
**PDF:** zoom 50 %–400 % in steps (50, 67, 75, 90, 100, 110, 125, 150, 175, 200, 300, 400); *Fit width*; *Fit page*. Ctrl + / Ctrl − / Ctrl+0 (= Fit page). Ctrl+mouse wheel also zooms.
**EPUB:** text size 14–28 px in 2 px steps (default 18); font Serif/Sans. Ctrl + / Ctrl − change text size.
**Remembered per book.**

| # | Acceptance criterion | Scope |
|---|---|---|
| F03.1 | Given a PDF at 100 %, when I press Ctrl +, then it shows 110 % and the text stays sharp (no blur). | PDF |
| F03.2 | Given a PDF, when I click *Fit width* and then resize the window, then the page keeps fitting the width. | PDF |
| F03.3 | Given an EPUB at 18 px, when I click A+, then text becomes 20 px, the text reflows and I stay at the same place in the text (same location ± one screen). | EPUB |
| F03.4 | Given I set a zoom or text size for a book, when I close and reopen it, then the same setting is restored. | Both |

### F04 · Library (simple title list)
**User sees:** a list of every book ever opened: title, author, type, last opened, progress %. Sorted by last opened (newest first).
**Title/author** come from the book's metadata; if missing, the file name is used as the title and author shows "—".

| # | Acceptance criterion | Scope |
|---|---|---|
| F04.1 | Given I open a new book, when I go back to the library, then it appears at the top of the list. | Both |
| F04.2 | Given a book in the list, when I click ✕ and confirm, then it disappears from the list together with its bookmarks/highlights/notes, and **the file on disk is untouched**. | Both |
| F04.3 | Given the same file is renamed or moved and then opened again, when I look at the library, then it is still one entry (identified by file content, not path) with its old progress and highlights. | Both |
| F04.4 | Given an empty library, then I see the empty-state message with an *Open book…* button. | — |

### F05 · Remember last position
| # | Acceptance criterion | Scope |
|---|---|---|
| F05.1 | Given I'm on page 87 of a PDF, when I close the app and open the same book, then page 87 shows. | PDF |
| F05.2 | Given I'm part-way through an EPUB, when I close and reopen it — even with a different window size — then the same passage of text is visible at the top of the screen. | EPUB |
| F05.3 | Given the app crashes or is killed, when I reopen, then the position is no more than one page change out of date (position is saved on every page change). | Both |

### F06 · Bookmarks
**User does:** clicks 🔖 or presses Ctrl+B to toggle a bookmark on the current page.
**Bookmark label:** auto-generated — chapter title (if known) + "p. 12" (PDF) or "37%" (EPUB) — plus the date added.
**Sidebar → Bookmarks tab:** list in book order; click to jump; 🗑 to delete.

| # | Acceptance criterion | Scope |
|---|---|---|
| F06.1 | Given a page with no bookmark, when I press Ctrl+B, then 🔖 becomes filled and the bookmark appears in the Bookmarks tab. Pressing Ctrl+B again removes it. | Both |
| F06.2 | Given several bookmarks, when I click one in the list, then that page shows. | Both |
| F06.3 | Given bookmarks exist, when I restart the app and reopen the book, then they are all still listed. | Both |
| F06.4 | Given no bookmarks, then the tab shows "No bookmarks yet. Press Ctrl+B to add one." | Both |

### F07 · Single-page view, no animations
| # | Acceptance criterion | Scope |
|---|---|---|
| F07.1 | Given any window size, then exactly one page (PDF) or one column of text (EPUB) is shown — never a two-page spread. | Both |
| F07.2 | Given any page change, zoom or theme switch, then the change is instant — no flip, slide or fade. | Both |
| F07.3 | Given a PDF page smaller than the window, then it is centred horizontally with the `--bg` colour around it. | PDF |

### F08 · Day / night mode
**User does:** clicks ☀/☾ or presses Ctrl+Shift+N. The choice is global (not per book) and remembered. First launch follows the Windows light/dark setting.

| # | Acceptance criterion | Scope |
|---|---|---|
| F08.1 | Given day mode, when I toggle, then toolbar, sidebar, library and reading pane all switch to the night colours at once. | Both |
| F08.2 | Given night mode and a PDF, then the page is shown inverted (dark background, light text) and highlights keep their night highlight colours (not inverted). | PDF |
| F08.3 | Given night mode and an EPUB, then the text uses `--ink` on `--page` night colours. | EPUB |
| F08.4 | Given I chose night mode, when I restart the app, then it opens in night mode. | — |

### F09 · Word search
**User does:** presses Ctrl+F (or 🔍) → the Search tab opens with the cursor in the box → types a word/phrase → Enter.
**Rules:** whole book; case-insensitive; ignores accents (é = e); minimum 2 characters; results capped at 500 with a note "Showing first 500 results".
**User sees:** a result list: snippet with the match in bold + page/location. Clicking a result jumps there and briefly marks the match (a static outline, not an animation). Enter / Shift+Enter in the box move to the next / previous result.

| # | Acceptance criterion | Scope |
|---|---|---|
| F09.1 | Given a book, when I search for a word that occurs in it, then a result list appears with the number of matches and each snippet. | Both |
| F09.2 | Given results, when I click one, then that page shows and the match is outlined on the page. | Both |
| F09.3 | Given a word not in the book, then I see "No results for '…'". | Both |
| F09.4 | Given a scanned PDF with no text, when I search, then I see "This book has no searchable text (it may be scanned)." | PDF |
| F09.5 | Given a 500-page PDF, when I search, then the first results appear within 2 s and results keep filling in without freezing the window; I can cancel by clearing the box. | PDF |

### F10 · Table of contents
**Sidebar → Contents tab:** the book's outline as a tree (nested levels collapsible, ▸/▾). The entry for the current chapter is highlighted.

| # | Acceptance criterion | Scope |
|---|---|---|
| F10.1 | Given a book with an outline/TOC, when I open the Contents tab, then I see its entries in order with nesting. | Both |
| F10.2 | Given the tree, when I click an entry, then that chapter/page shows. | Both |
| F10.3 | Given a book without an outline, then the tab shows "This book has no table of contents." | Both |
| F10.4 | Given I move to another chapter by paging, then the current-chapter highlight in the tree follows. | Both |

### F11 · Highlights
**User does:** selects text with the mouse → a small popup appears above it: colour dots (yellow default, green, blue, pink) · *Note* · *Copy*. Clicking a dot creates the highlight.
**Clicking an existing highlight** shows the popup with: colour dots (change colour) · *Note* · *Delete*.
**Sidebar → Highlights tab:** list in book order: colour bar, quoted text (first ~150 chars), page/location, note preview. Click to jump.

| # | Acceptance criterion | Scope |
|---|---|---|
| F11.1 | Given I select text and click yellow, then the text shows a yellow highlight and an entry appears in the Highlights tab. | Both |
| F11.2 | Given a highlight, when I zoom (PDF), change text size (EPUB), resize the window or restart the app, then the highlight still covers exactly the same words. | Both |
| F11.3 | Given a highlight, when I click it and choose *Delete*, then it disappears from the page and the list (and its note too). | Both |
| F11.4 | Given a selection that spans two PDF pages, then the highlight is not allowed: the popup shows "Select text on one page at a time". | PDF |
| F11.5 | Given a scanned PDF page, then no selection popup appears (no text to select). | PDF |

### F12 · Notes on highlights
**User does:** clicks *Note* in the popup (on a new selection this also creates a yellow highlight) → a small text box opens → types → *Save* (or Ctrl+Enter). Esc cancels.
**User sees:** highlights with a note show a small ✎ marker at the end; the Highlights tab shows the note text under the quote; hovering a highlight with a note shows the note as a tooltip.
**Notes are plain text** (no formatting), up to 5,000 characters.

| # | Acceptance criterion | Scope |
|---|---|---|
| F12.1 | Given a highlight, when I add a note and save, then the ✎ marker appears and the note shows in the Highlights tab. | Both |
| F12.2 | Given a note, when I click the highlight → *Note*, then I can edit it; saving an empty note removes the note but keeps the highlight. | Both |
| F12.3 | Given notes exist, when I restart the app and reopen the book, then all notes are still there. | Both |

### F13 · Full screen
| # | Acceptance criterion | Scope |
|---|---|---|
| F13.1 | Given the reading screen, when I press F11 (or ⛶), then the window fills the screen and the toolbar and sidebar hide. | Both |
| F13.2 | Given full screen, when I press Esc or F11, then the window returns to its previous size. | Both |
| F13.3 | Given full screen, all reading shortcuts (pages, search, bookmark) still work. | Both |

### F14 · Windows installer
| # | Acceptance criterion | Scope |
|---|---|---|
| F14.1 | Given `Ebook-Reader-Setup-X.Y.Z.exe`, when I run it, then I can choose the install folder and it creates a Start-menu shortcut "Ebook Reader". | — |
| F14.2 | Given the installed app, when I open it with no internet, then everything works (offline). | — |
| F14.3 | Given I uninstall and reinstall, then my library, bookmarks, highlights and notes are still there. | — |
| F14.4 | Given the installed app, then there is no developer menu or DevTools shortcut. | — |

### F15 · Open books from File Explorer ("Open with") · added 2026-10-06 for v1.1.0
**User does:** right-clicks a `.pdf` or `.epub` in File Explorer → *Open with* → **Ebook Reader** (or double-clicks it, once Ebook Reader is the chosen app for that file type).
**User sees:** the book opens straight away on the reading screen, at its saved position; if the app was already open, the book opens in that same window, which comes to the front.
**Windows rule:** since Windows 10, an installer may *offer* itself for a file type but may not silently make itself the default. Windows asks the user ("How do you want to open this file?") or the user picks it in *Open with* / Settings → Default apps (Q7).

| # | Acceptance criterion | Scope |
|---|---|---|
| F15.1 | Given the app is installed, when I right-click a `.pdf` or `.epub` → *Open with*, then **Ebook Reader** is listed (with its icon). | Both |
| F15.2 | Given the app is closed, when I open a book through *Open with* (or by double-click once it's the chosen app), then the app starts and shows that book directly, at its saved position, without a stop at the library. | Both |
| F15.3 | Given the app is already open (library or another book), when I open a book from File Explorer, then it opens in the **same** window (no second window) and the window comes to the front, even if it was minimised. | Both |
| F15.4 | Given a file that is missing, damaged or not a book reaches the app this way, then I see the usual plain-language message on the library screen; nothing crashes. | Both |
| F15.5 | Given I uninstall the app, then *Open with* no longer lists it, and no book file was changed. | — |

### F16 · Recognise text in scanned PDFs (OCR) · DRAFT 2026-10-06 for v1.2.0, awaiting approval
**Why:** today a scanned PDF (pages that are only pictures) can't be searched, highlighted or given notes; the app just says so (F09.4, F11.5). OCR ("optical character recognition") reads the picture and produces the text, so those books work like any other.
**User does:** opens a scanned PDF. A page without text shows a slim notice above the page: *"This page is a picture, so its text can't be selected or searched. **Recognise text**"*. Clicking it reads that page. A second choice in the same notice, *Recognise the whole book*, reads every page in the background.
**User sees:** a progress note ("Reading page 12 of 240…", with *Cancel*) while the book stays readable. When a page is done, its text can be selected, highlighted, given notes, and found by search. A small, permanent note reminds: *"Recognised text may contain mistakes."*
**Rules:**
- **PDF only.** EPUBs already have text.
- **Offline:** the recognition engine and its English language data ship inside the app. Nothing is downloaded or sent anywhere (Q9).
- **The PDF is never changed.** Recognised text is stored in the app's own data folder, per book, and reused next time (a page is only read once).
- Recognition runs only when asked, never automatically.
- The window stays responsive while it runs; you can keep reading, turn pages or close the book.

| # | Acceptance criterion | Scope |
|---|---|---|
| F16.1 | Given a PDF page with no text, then a notice offers **Recognise text** and **Recognise the whole book**. Pages that already have text show no notice. | PDF |
| F16.2 | Given I click **Recognise text**, then a progress note shows, and when it finishes the page's words can be selected and highlighted, and the notice is gone. | PDF |
| F16.3 | Given I click **Recognise the whole book**, then progress "Reading page N of M" updates, I can keep reading and turning pages meanwhile, and **Cancel** stops it. Pages already finished keep their text. | PDF |
| F16.4 | Given recognised pages, when I search, then matches on those pages appear in the results, and clicking one jumps to the page and outlines the word (F09.1, F09.2). | PDF |
| F16.5 | Given a PDF with no text and nothing recognised yet, when I search, then the message becomes "This book has no searchable text. Recognise it to search." with a **Recognise the whole book** button (changes F09.4). | PDF |
| F16.6 | Given highlights and notes on recognised text, when I zoom, resize the window or restart the app, then they still cover exactly the same words (F11.2). Recognised text is reused, not re-read. | PDF |
| F16.7 | Given I closed the app in the middle of "Recognise the whole book", when I open the book again, then the finished pages are still recognised and the rest can be continued. | PDF |
| F16.8 | Given a blank page or one with no readable text, then I see "No text found on this page." and the app carries on. A failure shows a plain message and never crashes or freezes the app. | PDF |
| F16.9 | Given a book is removed from the library, then its recognised text is removed with its bookmarks and notes (F04.2). The PDF file is byte-for-byte unchanged by recognising. | PDF |
| F16.10 | Given the app is used with recognition, then no network request is made (checked in Stage 04). | PDF |
| F16.11 | Given a normal clean scanned page on a typical laptop, then recognising one page takes no more than about 10 s. (**To be measured first in a test on a real scanned book; adjust before approving.**) | PDF |

**Notes for Stage 02 (not part of the spec the user approves):**
- Engine: Tesseract.js (Apache-2.0) in a web worker, with the WebAssembly core and `eng` language data bundled. The page CSP needs `worker-src` and `'wasm-unsafe-eval'`; the offline blocker must still allow only `app://` requests.
- Data model change: per-book recognised text (page → words with positions), stored in `books/<id>.json` or a sibling file. Needs a decisions-log entry and a schema version bump.
- Recognised words become an invisible text layer so the existing search, selection and highlight anchors (page + text offsets) work unchanged.
- Before building: a small spike on 2–3 real scanned books to measure speed and accuracy and decide the language data size (`tessdata_fast` vs `tessdata`).

---

## Keyboard shortcuts

| Action | Shortcut | Notes |
|---|---|---|
| Open book | Ctrl+O | anywhere |
| Back to library | Alt+← or Ctrl+L | reading screen |
| Next page | → · PgDn · Space · ↓ (at bottom edge) | |
| Previous page | ← · PgUp · Shift+Space · ↑ (at top edge) | |
| First / last page | Home / End | |
| Go to page | Ctrl+G | focuses the page box |
| Zoom in / out (PDF) · text size (EPUB) | Ctrl + / Ctrl − · Ctrl+wheel | |
| Fit page (PDF) / default size (EPUB) | Ctrl+0 | |
| Search | Ctrl+F · then Enter / Shift+Enter | |
| Toggle bookmark | Ctrl+B | |
| Toggle sidebar | Ctrl+\ | |
| Day / night | Ctrl+Shift+N | |
| Full screen | F11 · Esc to exit | |
| Save note | Ctrl+Enter · Esc cancels | in note box |

Shortcuts must also work when keyboard focus is inside the EPUB content (iframe). Shortcuts are disabled while typing in the search box or note box (except Esc, Enter, Ctrl+Enter).

---

## Non-functional

- **Offline:** no network requests at runtime (checked in Stage 04 with DevTools network tab in a dev build).
- **Book files are read-only** to the app.
- **Startup:** library visible within 2 s on a normal laptop.
- **Large PDFs (500+ pages):** opening and paging stay responsive; only the current page (±1 pre-rendered) is kept in memory.
- **Data safety:** app data is saved atomically; a crash never corrupts the library file.
- **Window size & position** are remembered between launches (small convenience, no separate feature ID).

---

## Open questions

| # | Question | Answer |
|---|---|---|
| Q1 | EPUB progress display | ✅ **Location + %** ("Location 1203 of 3410 · 37%"), answered 2026-10-04 |
| Q2 | Highlight colours | ✅ **4 colours** (yellow default, green, blue, pink), answered 2026-10-04 |
| Q3 | Startup screen | ✅ **Library**, answered 2026-10-04 |
| Q4 | Interface language | ✅ **English**, answered 2026-10-04 |
| Q5 | Notes only on highlights, or also free-standing notes on a page? | ✅ **Highlights only** (default accepted at approval) |
| Q6 | Bookmarks: editable names, or the automatic label only? | ✅ **Automatic label only** (default accepted at approval) |
| Q7 | F15: should the installer only **offer** Ebook Reader for .pdf/.epub (you choose it in Open with), or also try to become the **default**? | ✅ Offer only, for both; never take over the default (approved 2026-10-06) |
| Q8 | F16: when should OCR run? | ⏳ Suggestion: **only when you click** (*Recognise text* for one page, or *the whole book*), never automatically, so the app never uses the CPU behind your back |
| Q9 | F16: which languages? Each language adds its own data file to the installer. | ⏳ Suggestion: **English only** in the first version (about +15 MB installer). Others (e.g. Malay) can be added later |
| Q10 | F16: is it OK that the installer grows by about 10–20 MB and the OCR engine is bundled? | ⏳ Suggestion: yes |
| Q11 | F16: where is the recognised text kept? | ⏳ Suggestion: in the app's data folder only, per book, reused next time. The PDF is **never** modified (so no "save as searchable PDF" in this version) |
