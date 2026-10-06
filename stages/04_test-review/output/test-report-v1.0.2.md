# Test report · Ebook Reader v1.0.2

(Started as the v1.0.1 report; the user's hand test of 1.0.1 found B003, fixed in 1.0.2. 1.0.2 differs from 1.0.1 only by that fix.)

Date: 2026-10-06 · Build: `app/release/Ebook-Reader-Setup-1.0.1.exe` (commit `0833426` + Stage 04 docs) · Tester: Claude (automated + scripted); hand tests: the user.

**Status: ✅ READY — signed off 2026-10-06 for v1.0.2.** All criteria pass; hand test H1–H5 pass (H5 after the B003 fix, confirmed by the user on the installed 1.0.2). 0 open bugs.

## How it was tested

| Method | What | Result |
|---|---|---|
| Type-check | `npm run typecheck` (main, renderer, tests) | ✔ |
| Unit tests | `npm test`: 46 tests (storage, schemas, search text model, CFI/locations, TOC, zoom, keymap, highlight re-anchoring) | ✔ 46/46 |
| End-to-end tests | `npx playwright test`: **81 tests**, each launching the real app with an empty, temporary data folder; **3 full runs in a row** | ✔ 81/81 ×3 |
| Scripted checks on the **packaged** app | `release/win-unpacked/Ebook Reader.exe` (exactly what the installer installs): start-up time, large/RTL books, network, restart test, EPUB recolour/delete | ✔ (details below) |
| Screenshots | things the tests can't see: EPUB overlays (search outline, highlights, ✎) live in foliate's closed shadow DOM; colours in day/night | ✔ |
| Book files untouched | SHA-256 of all 13 test books before vs after the 3 full e2e runs | ✔ 13/13 identical |
| By hand (user) | F01.2 drag a PDF from Explorer (S1); installed v1.0.0 → found **B002**; installed v1.0.1 → B002 gone | ✔ |

Method key used below: **A** = automated e2e/unit · **S** = scripted check on the packaged app · **V** = visual check of screenshots · **H** = by hand (user) · **—** = not tested.

## Acceptance criteria (spec v1)

| ID | Criterion (short) | PDF | EPUB | Method | Notes |
|---|---|---|---|---|---|
| F01.1 | Ctrl+O opens a book < 3 s | ✔ | ✔ | A, S | Typical open 0.1–0.9 s; 55 MB PDF 0.5 s |
| F01.2 | Drag & drop opens; other file types → message | ✔ | ✔ | A, H | PDF (S1) and EPUB (H4) dropped from Explorer by hand ✔; wrong type ✔ (A) |
| F01.3 | Corrupt / DRM file → plain error, back to library | ✔ | ✔ | A | DRM EPUB message; font obfuscation is *not* treated as DRM |
| F01.4 | Password PDF: prompt, wrong → retry, never saved | ✔ | n/a | A | |
| F01.5 | Missing file → Locate file… / Remove from library | ✔ | ✔ | A | Locate reconnects position; changed file → "use anyway?" |
| F02.1 | → / PgDn / ▶ next, ← back | ✔ | ✔ | A, H | EPUB also with focus inside the text. **Mouse wheel in EPUB was missing (B003, found by hand) → fixed in 1.0.2** (A + S) |
| F02.2 | No wrap-around at the ends | ✔ | ✔ | A | ◀/▶ disabled at the ends |
| F02.3 | Page box jumps; invalid input resets | ✔ | n/a | A | EPUB has a location box (A) |
| F02.4 | Home / End | ✔ | ✔ | A | |
| F02.5 | Zoomed page scrolls; wheel at the edge → next page | ✔ | n/a | A | |
| F03.1 | Ctrl + → 110 %, text sharp | ✔ | n/a | A | Canvas resolution = CSS size × screen scale |
| F03.2 | Fit width survives window resize | ✔ | n/a | A | |
| F03.3 | A+ → 20 px, re-flow, same place | n/a | ✔ | A | |
| F03.4 | Zoom / text size remembered per book | ✔ | ✔ | A | |
| F04.1 | New book at the top of the library | ✔ | ✔ | A | |
| F04.2 | ✕ + confirm removes entry and its data, **file untouched** | ✔ | ✔ | A | |
| F04.3 | Renamed/moved file = same entry, same progress | ✔ | ✔ | A | Identity = SHA-256 of the content |
| F04.4 | Empty-state message + Open book… | ✔ | ✔ | A | |
| F05.1 | PDF reopens at the same page | ✔ | n/a | A, S | |
| F05.2 | EPUB reopens at the same passage, other window size | n/a | ✔ | A | |
| F05.3 | Position survives a crash (≤ 1 page behind) | ✔ | ✔ | A | Hard kill (SIGKILL): exact page restored |
| F06.1 | Ctrl+B toggles a bookmark; button filled | ✔ | ✔ | A | Button is ☆ / ★ (spec says 🔖; same meaning) |
| F06.2 | Click a bookmark → jumps there | ✔ | ✔ | A | Listed in book order with chapter labels |
| F06.3 | Bookmarks survive a restart | ✔ | ✔ | A, S | |
| F06.4 | Empty message | ✔ | ✔ | A | |
| F07.1 | One page / one column only | ✔ | ✔ | A | |
| F07.2 | No flip/slide/fade | ✔ | ✔ | A | No transitions anywhere, incl. inside the book |
| F07.3 | Small PDF page centred | ✔ | n/a | A | |
| F08.1 | Toggle switches everything at once | ✔ | ✔ | A | Button + Ctrl+Shift+N; native UI follows |
| F08.2 | Night: PDF page inverted, highlights keep night colours | ✔ | n/a | A, V | Inversion A; highlight colours V |
| F08.3 | Night: EPUB text = night ink on night page | n/a | ✔ | A, V | **B002** (margins kept the old colour) fixed in 1.0.1 + regression test |
| F08.4 | Theme remembered | ✔ | ✔ | A | First launch follows Windows |
| F09.1 | Result list with count, snippet, page | ✔ | ✔ | A | Case- and accent-insensitive |
| F09.2 | Click result → jumps + match outlined | ✔ | ✔ | A, V | EPUB outline checked visually |
| F09.3 | "No results for '…'" | ✔ | ✔ | A | Also "Type at least 2 characters." |
| F09.4 | Scanned PDF → "no searchable text" | ✔ | n/a | A, S | Real Mims PDF: 92 ms |
| F09.5 | 500-page PDF: results < 2 s, no freezing, cancel | ✔ | n/a | A | First results 64 ms; longest frame gap 50 ms |
| F10.1 | Contents tree in order, nested | ✔ | ✔ | A | |
| F10.2 | Click entry → jumps | ✔ | ✔ | A | Incl. PDF named destinations |
| F10.3 | "This book has no table of contents." | ✔ | ✔ | A, S | |
| F10.4 | Current chapter highlight follows paging | ✔ | ✔ | A | |
| F11.1 | Select → yellow → highlighted + listed | ✔ | ✔ | A | 4 colours + Copy |
| F11.2 | Highlight stays on the words after zoom / text size / resize / restart | ✔ | ✔ | A | PDF geometry within 3 px; EPUB by clicking the words |
| F11.3 | Click → Delete removes it from page and list | ✔ | ✔ | A, S | EPUB recolour + delete: S |
| F11.4 | Selection across pages refused with a message | ✔ | n/a | A | Single-page view makes two pages impossible; tested as "selection runs off the page" |
| F11.5 | Scanned page → no popup | ✔ | n/a | A | |
| F12.1 | Add note → ✎ marker + note in list | ✔ | ✔ | A, V | EPUB ✎ visually; hover tooltip A (both) |
| F12.2 | Edit; empty note removes note, keeps highlight | ✔ | ✔ | A | Empty-note case automated on PDF; same code path for EPUB |
| F12.3 | Notes survive a restart | ✔ | ✔ | A, S | |
| F13.1 | F11 / ⛶ → full screen, toolbar and sidebar hidden | ✔ | ✔ | A | Toolbar returns at the top edge |
| F13.2 | Esc / F11 leave full screen | ✔ | ✔ | A | |
| F13.3 | Shortcuts work in full screen | ✔ | ✔ | A | |
| F14.1 | Installer: choose folder, Start-menu shortcut | ✔ | ✔ | H | H1: folder can be chosen; Start-menu entry with the user's logo |
| F14.2 | Installed app works with no internet | ✔ | ✔ | S, H | S: zero outgoing requests in a full session; H2: everything works with Wi-Fi off |
| F14.3 | Uninstall + reinstall keeps the data | ✔ | ✔ | H | H3: books and bookmarks still there after uninstall + reinstall |
| F14.4 | No developer menu / DevTools | ✔ | ✔ | S | No menu; F12 and Ctrl+Shift+I do nothing in the packaged app |

## Non-functional requirements

| Requirement | Result | Method | Evidence |
|---|---|---|---|
| Offline: no network requests | ✔ | A, S | e2e: `fetch()` to the internet is blocked; EPUB internet image and inline script blocked. Packaged session (5 books, search, highlights, restart): the offline guard never fired, so nothing even tried |
| Book files are read-only | ✔ | S | 13/13 test books byte-identical after 3 full e2e runs |
| Start-up: library within 2 s | ✔ | S | 518–533 ms (packaged app, 3 cold starts) |
| Large PDFs responsive, memory bounded | ✔ | A, S | 500 pages: 68 ms/turn (A). **55 MB / 24 big-image pages: opens in 0.5 s, median 33 ms/turn**; memory 585 → 698 MB after 23 turns (the GPU cache warming, as measured in S2: flat on later passes) |
| Data safety (atomic saves, no corruption) | ✔ | A | Unit: atomic write, merge, corrupt-file recovery; e2e: hard kill keeps the position |
| Window size & position remembered | ✔ | A | |

## Awkward books (`shared/test-books.md`)

| Book | Result | Method |
|---|---|---|
| Normal EPUB (Carnegie, real) | ✔ opens, pages, search 32 hits, highlights + notes | S, V |
| EPUB without TOC | ✔ message | A |
| **Right-to-left (Arabic) EPUB** (generated for Stage 04) | ✔ opens, text right-to-left, TOC, search 60 hits with outline, paging | S, V |
| CJK EPUB | **—** not tested (no sample) | — |
| PDF with outline / without | ✔ | A |
| Scanned PDF (Mims, real, 13 MB) | ✔ renders, search says "no searchable text", no highlight popup | A, S |
| **Very large PDF** (generated 55 MB) | ✔ see above | S |
| Password PDF | ✔ | A |

## Restart test (Stage 04 step 3)

Packaged app, own data folder: added a bookmark, a highlight and a note on a PDF → closed the app → reopened → bookmark ✔ (★ on), highlight ✔, note ✔ with ✎ marker. Also covered for PDF and EPUB by the e2e tests (F06.3, F11.2, F12.3).

## Bugs (see `bug-list.md`)

| ID | Summary | Status |
|---|---|---|
| B001 | Intermittent e2e timeout opening a PDF (S4) | **Verified fixed**: the cause was a test race (fixed in S9); not seen in the 3 Stage 04 runs (243 test executions) nor in the 10+ full runs since S9 |
| B002 | EPUB margins kept the old theme colour (found by the user) | **Verified fixed** in 1.0.1: user confirmed + automated regression test |
| B003 | Mouse wheel did nothing in EPUBs (found by the user, H5) | **Verified fixed** in 1.0.2: user confirmed on the installed app + e2e test |

## Observations (not bugs, not v1 scope)

- **Right-to-left books:** → / ▶ always mean "forward in the book". Readers of Arabic or Hebrew might expect ← to go forward → logged as later idea L07.
- Clicking into the page while the note box is open closes it without saving (like Cancel).
- Links to websites inside EPUBs do nothing (offline by design).
- Bookmark labels in long chapters look alike → later idea L06.

## Hand test for the user (to sign off v1.0.1)

About 10 minutes, on the installed app:

| # | Check | Covers |
|---|---|---|
| H1 | Did the installer let you choose the install folder, and is there an **Ebook Reader** entry with your logo in the Start menu? | F14.1 |
| H2 | Turn **Wi-Fi off**, open a book, turn pages, search a word, then turn Wi-Fi back on | F14.2 |
| H3 | *(optional)* Uninstall (Settings → Apps), reinstall 1.0.1: are your books, bookmarks, highlights and notes still there? | F14.3 |
| H4 | Drag the **Carnegie EPUB** from File Explorer onto the app window | F01.2 (EPUB) |
| H5 | Just read for a bit (PDF and EPUB): page, zoom / A+, night mode, full screen, a bookmark, a highlight with a note, search, contents. Anything odd, slow or confusing? | overall |

Sign-off: when H1, H2, H4 and H5 are OK (H3 optional), mark the version **ready** and the features ✅ in `shared/feature-register.md`.

### Hand test results (user, 2026-10-06, installed v1.0.1)

| # | Result |
|---|---|
| H1 | ✔ install folder can be chosen; Start-menu entry with the logo |
| H2 | ✔ everything works offline |
| H3 | ✔ after uninstall + reinstall, books and bookmarks are still there |
| H4 | ✔ dragging the EPUB from Explorer works |
| H5 | ✘ EPUB: the mouse wheel doesn't turn pages (arrow keys fine, everything else fine) → **B003**, fixed in **v1.0.2** |

After B003: automated suite 82/82 ×2, unit 46/46; packaged 1.0.2 checked with the Carnegie EPUB (wheel forward/back). **User confirmed on the installed 1.0.2: the mouse wheel turns EPUB pages (2026-10-06). → Signed off.**

## Sign-off

- **Version:** 1.0.2 · installer `Ebook-Reader-Setup-1.0.2.exe` · SHA-256 `7729cc4217e9935b9d4950f997dfc882904aa1a2c4a389f9ec71cb04f8562f80`
- **Decision:** ready for release. Open bugs: none. Untested: CJK books (no sample); a clean second Windows user account (installed only on the user's own account).
- Signed off by the user (hand test + confirmation of B003) and Claude (automated and scripted checks), 2026-10-06.
