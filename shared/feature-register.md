# Feature register

Stages 03–05 update this file. Status: ⬜ not started · 🔨 in progress · 🔍 built, needs testing · ✅ tested and signed off · 💤 later (not v1).

**Current version:** 1.1.1 · **Last release:** v1.1.1 on 2026-10-06 (signed off in `stages/04_test-review/output/test-report-v1.1.1.md`; previous: v1.1.0, v1.0.2)

## v1

| ID | Feature | PDF | EPUB | Notes | Status |
|---|---|---|---|---|---|
| F01 | Open a book (Ctrl+O, drag and drop, from the library) | ✔ | ✔ | PDF (S1), EPUB (S3), from the library + missing file (S4) done | ✅ |
| F02 | Page navigation: next/prev, go to page, keyboard, first/last | ✔ | ✔ | EPUB "pages" = screen pages + % / location. PDF (S2) + EPUB (S3); EPUB mouse wheel added in 1.0.2 (B003) | ✅ |
| F03 | Zoom (PDF: fit width / fit page / ±) · text size (EPUB: A−/A+) | ✔ | ✔ | PDF (S2), EPUB (S3), remembered per book (S4) done | ✅ |
| F04 | Library: simple list of titles; remove from list | ✔ | ✔ | Removing never deletes the file. Done in S4 | ✅ |
| F05 | Remember the last position and reopen there | ✔ | ✔ | Done in S4 | ✅ |
| F06 | Bookmarks: toggle, list, jump to, delete | ✔ | ✔ | Done in S7 | ✅ |
| F07 | Single-page view, no animations | ✔ | ✔ | PDF (S2) + EPUB (S3) done | ✅ |
| F08 | Day / night mode | ✔ | ✔ | Done in S5 | ✅ |
| F09 | Basic word search with a result list | ✔ | ✔ | Scanned PDFs without a text layer can't be searched; show a message. Done in S8 | ✅ |
| F10 | Clickable table of contents | ✔ | ✔ | Show "No contents" if the book has none. Done in S6 | ✅ |
| F11 | Highlights: select text → highlight, list, delete | ✔ | ✔ | Done in S9 | ✅ |
| F12 | Notes attached to highlights: add, edit, view in the list | ✔ | ✔ | Done in S10 | ✅ |
| F13 | Full screen (F11) | ✔ | ✔ | Done in S5 | ✅ |
| F14 | Windows installer (.exe) with a Start-menu shortcut | — | — | Installer with the user's logo (S11); install, offline and reinstall hand-tested (H1–H3) | ✅ |
| F15 | Open books from File Explorer ("Open with", double-click) | ✔ | ✔ | v1.1.0 (was later idea L03). Installer offers itself only and never takes over the default; signed off 2026-10-06 (`test-report-v1.1.0.md`, hand test H1–H6) | ✅ |

## Later (do not build in v1)

| ID | Idea | Status |
|---|---|---|
| L01 | Two-page spread / continuous scroll | 💤 |
| L02 | Cover thumbnails in the library | 💤 |
| L03 | "Open with" file association for .pdf / .epub | → moved to v1.1.0 as F15 |
| L04 | Export highlights and notes to Markdown | 💤 |
| L05 | Sepia theme | 💤 |
| L06 | Bookmark labels also show the first words of the page (labels in long chapters look alike) | 💤 |
| L07 | Right-to-left books: ← goes forward (mirror the arrow keys / ◀ ▶) | 💤 |
