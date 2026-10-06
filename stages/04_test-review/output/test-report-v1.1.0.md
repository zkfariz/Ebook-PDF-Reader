# Test report · Ebook Reader v1.1.0

Date: 2026-10-06 · Build: `stages/05_package-release/output/installers/Ebook-Reader-Setup-1.1.0.exe` (commit `5892488`, SHA-256 `f8e55a7b3a58836e15610b193d3e72e3a45b37d7f6acfe38937004282577a911`) · Tester: Claude (automated + scripted); hand test: the user.

**Status: ✅ READY — signed off 2026-10-06 for v1.1.0.** The only change since the signed-off v1.0.2 is the new feature F15 ("Open with" from File Explorer). All F15 criteria pass, the whole v1.0.2 suite still passes, and hand test H1–H6 passes. 0 open bugs.

## How it was tested

| Method | What | Result |
|---|---|---|
| Type-check | `npm run typecheck` (main, renderer, tests) | ✔ |
| Unit tests | `npm test`: 53 tests (46 from v1.0.2 + 7 new: reading the book path from the command line) | ✔ 53/53 |
| End-to-end tests | `npx playwright test`: **87 tests** (82 from v1.0.2 + 5 new for F15), **3 full runs in a row** | ✔ 87/87 ×3 |
| Scripted check on the **packaged** app | `release/win-unpacked/Ebook Reader.exe` started with a PDF, then a second start with an EPUB | ✔ opened directly; then switched in the same window, and the second process exited |
| Book files untouched | SHA-256 of all 12 test books before vs after two full e2e runs | ✔ 12/12 identical |
| By hand (user) | installed 1.1.0 over 1.0.2; Explorer *Open with*; double-click; uninstall (H1–H6 below) | ✔ |

Method key: **A** = automated e2e/unit · **S** = scripted check on the packaged app · **H** = by hand (user) · **—** = not tested.

## Acceptance criteria: F15 (new)

| ID | Criterion (short) | PDF | EPUB | Method | Notes |
|---|---|---|---|---|---|
| F15.1 | After install, *Open with* lists Ebook Reader with its icon | ✔ | ✔ | H | H2 |
| F15.2 | Opening from Explorer while the app is closed → the book directly, at the saved position | ✔ | ✔ | A, S, H | A: saved page 2/3 restored; H3 |
| F15.3 | App already open → same window, brought to the front even if minimised | ✔ | ✔ | A, S, H | A: from library, from another book, minimised; same book again keeps the page. H4 |
| F15.4 | Missing / damaged / non-book file → plain message on the library, no crash | ✔ | (same path) | A | missing `.pdf`, corrupt `.pdf`, `.txt`. Damaged EPUBs use the same open path, already covered by F01.3 |
| F15.5 | Uninstall removes *Open with*; no book file changed | ✔ | ✔ | H | H6. Book files unchanged: the app never writes to them (12/12 hashes identical in A) |
| Q7 | Offer only: the default app is never taken over | ✔ | — | H | H5: Windows asked once which app to use. Nothing changed until the user chose |

## Earlier criteria (F01–F14)

They were not re-tested by hand. All of them are covered by the unchanged v1.0.2 automated suite, which passes 3× (see `test-report-v1.0.2.md` for which criteria are automated and which were hand-tested then). Code touched outside F15:
- `ReaderScreen` now restarts cleanly when another book is opened (`key={bookId}`). This is covered by the existing "open a second book" tests and the new F15.3 tests.
- The F05.3 test ("survives a hard kill") **now really kills the app.** Before, it only killed Playwright's launcher process. It passes.

## Hand test (the user, installed v1.1.0)

| # | Step | Result |
|---|---|---|
| H1 | Install 1.1.0 over 1.0.2; books still there | ✔ |
| H2 | Right-click a .pdf / .epub → *Open with* lists Ebook Reader | ✔ |
| H3 | App closed → open a book that way → opens directly at the saved page | ✔ |
| H4 | App open and minimised → open another book → same window, pops up | ✔ |
| H5 | Double-click a .pdf → Windows asks which app (default not taken over) | ✔ as intended |
| H6 | Uninstall → Ebook Reader gone from *Open with* | ✔ |

## Bugs

None found. `bug-list.md` is unchanged (B001–B003, all verified).

## Not tested
- A second, clean Windows account (same limitation as v1.0.2).
- "Install for all users" (per-machine). The hand test used the default per-user install; the registry script uses the install's own context, so it should behave the same.

## Sign-off

✅ **Ready for release as 1.1.0**, 2026-10-06. Note: after H6 the app is uninstalled on the user's PC; reinstall 1.1.0 to keep using it (data in `%APPDATA%\Ebook Reader` was kept).
