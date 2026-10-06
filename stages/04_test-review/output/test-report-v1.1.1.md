# Test report · Ebook Reader v1.1.1

Date: 2026-10-06 · Build: `Ebook-Reader-Setup-1.1.1.exe` (SHA-256 `fc68f2128b1e96fc37819905b84a24cd7c2551e5eb1bc53c665e18845a90694c`) · Tester: Claude (automated + scripted); hand test: the user.

**Status: ✅ READY — signed off 2026-10-06 for v1.1.1.** 1.1.1 differs from the signed-off 1.1.0 only by the fix for **B004** (night-mode text unreadable in EPUBs that set their own colours, found by the user with a Project Gutenberg book). 0 open bugs.

## How it was tested

| Method | What | Result |
|---|---|---|
| Type-check, unit tests | `npm run typecheck`, `npm test` | ✔ 53/53 |
| End-to-end tests | `npx playwright test`: **88 tests** (87 from 1.1.0 + the new B004 test), full run | ✔ 88/88 |
| B004 regression test | New fixture `styled.epub` (Gutenberg-style CSS: black body text on white); reads real screen pixels in night, day, night | ✔ passes; **fails without the fix** (checked) |
| Real book, by screenshot | the user's pg1661 *Sherlock Holmes* in night and day mode | ✔ light text on dark; day unchanged |
| By hand (user) | installed 1.1.1; night-mode text readable; screenshots taken with *Pride and Prejudice* in both themes | ✔ |

## Bugs
B004 — fixed and **verified** (see `bug-list.md`).

## Not tested / known
- EPUBs from other publishers with unusual colour schemes. Boxes or tables with their own light background could still show light text on a light box in night mode.
- Pictures with a baked-in white background (e.g. the decorative capital letters in the Gutenberg *Pride and Prejudice*) stay white in night mode. This is how the book is made; not changed.
- Everything else is covered by the unchanged 1.1.0 suite (see `test-report-v1.1.0.md`).

## Sign-off
✅ **Ready for release as 1.1.1**, 2026-10-06.
