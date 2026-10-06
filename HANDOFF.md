# Handoff · 2026-10-06 · v1.2.0 RELEASED (F16: OCR for scanned PDFs)

The project is complete for v1, plus F15 ("Open with" from File Explorer) in 1.1.0.

- **Latest:** **1.2.0** (tag `v1.2.0`, installer `stages/05_package-release/output/installers/Ebook-Reader-Setup-1.2.0.exe`): F16 text recognition for scanned PDFs (Tesseract.js 7, English, offline, only on request; recognised text in `books/<id>.ocr.json`; code in `src/renderer/reader/ocr/` and `features/ocr/`; plan S12–S14 in `stages/02_architecture/output/build-plan.md`). Fixtures `scanned.pdf` (generator `make-scanned.mjs`), test helper `tests/e2e/scanHelper.ts`. Open ideas: removing ruled lines or cleaning images before OCR, more languages, a 2-engine mode for low-memory PCs.
- **Previous:** **1.1.1** (tag `v1.1.1`), installer `stages/05_package-release/output/installers/Ebook-Reader-Setup-1.1.1.exe`, SHA-256 in the release notes. Repo on GitHub: `zkfariz/Ebook-PDF-Reader` (private); README and screenshots in `docs/`.
- **Released:** Ebook Reader **1.1.0** (git tag `v1.1.0`). Installer: `stages/05_package-release/output/installers/Ebook-Reader-Setup-1.1.0.exe`, SHA-256 in the release notes. The user hand-tested it (H1–H6) and then uninstalled it as step H6, so it may need reinstalling (their data was kept).
- **F15 notes:** single-instance lock in `app/src/main/index.ts` + `openRequests.ts`; "Open with" registry entries in `app/build/installer.nsh` (not electron-builder's `fileAssociations`, see the decisions log). The e2e helper `hardKill` kills the real app process: `app.process()` is only Playwright's launcher.
- **Last verification (1.1.0):** 87/87 e2e (×3), 53/53 unit, type-check.

## v1.0.2 (previous release)

- **Released:** Ebook Reader **1.0.2** (git tag `v1.0.2`). Installer: `stages/05_package-release/output/installers/Ebook-Reader-Setup-1.0.2.exe` (also `app/release/`), SHA-256 in the release notes. Installed on the user's PC.
- **Docs:** release notes `stages/05_package-release/output/release-notes.md` · test report `stages/04_test-review/output/test-report-v1.0.2.md` (signed off) · bug list B001–B003 all verified · build log `stages/03_build/output/build-log.md` (S0–S11 + fixes) · decisions `shared/decisions-log.md`.
- **Feature register:** F01–F14 all ✅. Later ideas (not built): L01 two-page/continuous scroll · L02 covers · L04 export highlights · L05 sepia · L06 bookmark labels with first words · L07 RTL arrow direction.
- **Last verification:** 82/82 e2e (×2), 46/46 unit, type-check; hand test H1–H5 ✔.

## If work continues
- New feature / later idea → `CONTEXT.md` routing: add it to the register → Stage 01 (spec) → 03 → 04 → 05 (bump the version, e.g. 1.1.0).
- Bug in 1.0.2 → log in `stages/04_test-review/output/bug-list.md` (B004…) → fix in Stage 03 → re-test → 1.0.3.
- Working style, commands and repo gotchas: see the previous handoff in git history (`git show 779f7e8:HANDOFF.md`); the key ones:
  - Run in `app/`: `npm run dev` · `npm run typecheck` · `npm test` · `npm run build` then `npx playwright test` · `npm run dist`.
  - Stop the dev app before testing; tests use `launch()` (temp data folder) and `waitReady()`.
  - Never extract asar files inside `app/`. Write multi-line edits with the Edit tool or a `.cjs` script, not heredocs.
  - The user hand-tests every installer; report what was tested how.
