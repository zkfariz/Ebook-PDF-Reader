# Test report · Ebook Reader v1.2.0

Date: 2026-10-06 · Build: `Ebook-Reader-Setup-1.2.0.exe` (SHA-256 `7a081aacffa701e71a98957b843d558c15201c409fa8f7234260b39b797353a9`) · Tester: Claude (automated + scripted); hand test: the user.

**Status: ✅ READY — signed off 2026-10-06 for v1.2.0.** The change since the signed-off 1.1.1 is the new feature **F16, text recognition (OCR) for scanned PDFs**. All F16 criteria pass (one sub-case is listed as not tested below), the whole 1.1.1 suite still passes, and the user's hand test (7 steps) passed. 0 open bugs.

## How it was tested

| Method | What | Result |
|---|---|---|
| Type-check | `npm run typecheck` | ✔ |
| Unit tests | `npm test`: 73 tests (53 from 1.1.1 + 20 new: OCR storage, schema, geometry and noise filter, the whole-book queue) | ✔ 73/73 |
| End-to-end tests | `npx playwright test`: **100 tests** (88 from 1.1.1 + 12 new for F16), **3 full runs in a row** | ✔ 100/100 ×3 |
| Engine in the real, locked-down window | OCR engine run inside the app window (CSP, app:// and the offline blocker on), with a positive control proving the blocker log is captured | ✔ 0 blocked requests |
| Scripted checks on the **packaged** app | `release/win-unpacked`: engine on synthetic pages; `scanned.pdf` recognised as a whole book and searched | ✔ |
| Real scanned book (the user's Forrest Mims, 128 pages; private test, nothing from it saved in the project) | one page with a highlight (alignment), then the whole book | see F16.11 and Observations |
| Book files untouched | SHA-256 of all 14 test books before and after 2 full e2e runs | ✔ 14/14 identical |
| By hand (user) | installed 1.2.0; steps H1–H7 below | ✔ |

Method key: **A** = automated e2e/unit · **S** = scripted check on the packaged app · **R** = real scanned book (scripted) · **H** = by hand (user).

## Acceptance criteria: F16 (new)

| ID | Criterion (short) | Method | Notes |
|---|---|---|---|
| F16.1 | A page with no text shows the notice with **Recognise text** and **Recognise the whole book**; pages with text show none | A, H | |
| F16.2 | Recognise text → progress → the page's words can be selected and highlighted | A, S, R, H | highlight aligned with the picture (R) |
| F16.3 | Whole book: progress, keep reading meanwhile, **Cancel** keeps the finished pages | A, R, H | A: 3-page and 8-page books; R: 128 pages |
| F16.4 | Search finds words on recognised pages; click jumps and outlines | A, S, H | |
| F16.5 | No text and nothing recognised → "This book has no searchable text. Recognise it to search." + button | A, H | |
| F16.6 | Highlights and notes on recognised text stay on the same words after zoom, resize and restart; the text is reused, not re-read | A, H | zoom and restart tested; a window resize uses the same text-layer rebuild as zoom |
| F16.7 | Quitting in the middle of a run keeps the finished pages; the rest can be continued | A, H | |
| F16.8 | Blank page → "No text found on this page."; a failure is a plain message, never a crash | A (blank page); **— (failure)** | **The engine failing to start was not tested**; the message exists in the code |
| F16.9 | Removing a book removes its recognised text; the PDF is never changed | A (unit tests + hash check) | |
| F16.10 | No network request while recognising | A, S | 0 blocked requests, with a positive control |
| F16.11 | A clean scanned page takes no more than about 10 s | A, S, R | synthetic pages 4.3–5 s (dense full page, one engine); the real hand-lettered page 7.6 s; **whole 128-page book 5 min 29 s (about 2.6 s per page) with 3 engines on 8 cores** |

## Earlier criteria (F01–F15)

Not re-tested by hand. All are covered by the unchanged 1.1.1 automated suite, which passes 3 times. Code touched outside F16: the PDF adapter, the page text store and text layer (selection, search and highlights all read page text through the same path), the search panel message (the F09.4 text now depends on whether the book can be recognised; its test was updated), the reader screen, and one new IPC and data-file addition for OCR text.

## Hand test (the user, installed v1.2.0)

| # | Step | Result |
|---|---|---|
| H1 | Open the scanned PDF: notice shown; **Recognise text** on one page; select text and highlight a line | ✔ |
| H2 | **Recognise the whole book**; keep reading and turning pages; progress goes up | ✔ |
| H3 | **Cancel** partway; **Continue** | ✔ |
| H4 | Search a word after the run; click a result | ✔ |
| H5 | Quit and reopen: text still there, no second reading | ✔ |
| H6 | Memory use while it runs | ✔ accepted by the user |
| H7 | A normal PDF and an EPUB show no notice | ✔ |

The user reported that everything works fine as intended for all seven steps. No memory numbers were reported for H6.

## Observations (not bugs)
- **Accuracy depends heavily on the scan.** Synthetic clean and rough pages: 99.6–100 % of the words. The user's hand-lettered, ruled, diagram-heavy book (page 20): about 71 % of the readable key words found with default settings. Lines are sometimes merged around diagrams. The release notes say so.
- **Memory:** about 1.05 GB peak for the whole app during a whole-book run (3 engines), about 0.5 GB 25 s after it ends. A 2-engine setting is one constant (`workerCount`) if it is ever needed.
- **Noise filter:** lines the engine scores below 40 (of 100) are dropped, because blank scanned pages otherwise produced junk lines. The threshold has not been tuned on typeset real books.

## Bugs
None found in 1.2.0. `bug-list.md` is unchanged (B001–B004, all verified).

## Not tested
- Scanned books of several hundred pages; PCs with little memory or few cores; languages other than English.
- The engine failing to start (the message "Text recognition isn't available right now." was not provoked).
- PDF pages rotated by 90° or 270° (only the geometry code is unit-tested).
- Accuracy on typeset real-world scans (only synthetic pages and the user's hand-lettered book).
- A second, clean Windows account; "install for all users" (as in earlier releases).

## Sign-off
✅ **Ready for release as 1.2.0**, 2026-10-06.
