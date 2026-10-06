# Ebook PDF Reader

## Where am I?

This workspace builds a **simple, offline ebook reader for Windows** that opens **PDF and EPUB** files. It is a desktop app (Electron) that installs from a normal `.exe` setup file. Underneath it is a web UI, so during development it can also run in a browser.

The goal is a calm, distraction-free reader with the basics done well. It is not a full document editor.

Status: **v1.1.1 released 2026-10-06** (v1 features F01–F14 + F15 "Open with"; 1.1.1 fixes B004). All stages done; latest test report `stages/04_test-review/output/test-report-v1.1.1.md`, release notes `stages/05_package-release/output/release-notes.md`. Future work: the "Later" ideas in `shared/feature-register.md`; new features go back through Stage 01. **New session? Read `HANDOFF.md` first.**

Commands (run in `app/`): `npm run dev` · `npm run typecheck` · `npm test` · `npm run test:e2e` · `npm run dist` (installer).

## Folder map

```
CLAUDE.md                  Layer 0 · this file (always loaded)
CONTEXT.md                 Layer 1 · task routing: read next
stages/
  01_spec/                 turn the feature list into a written spec with acceptance criteria
  02_architecture/         confirm the tech stack, data model, module layout and build order
  03_build/                write the code (in /app), one feature slice at a time
  04_test-review/          manual and automated tests against the spec, bug list
  05_package-release/      build the Windows installer, versioning, release notes
    each stage: CONTEXT.md (contract) · references/ (Layer 3) · output/ (Layer 4)
app/                       the source code (Electron + Vite project). Stage 03 writes here.
_config/                   Layer 3 · tech stack, UI design system, coding conventions
shared/                    Layer 3 · feature register (status), decisions log, test books
skills/                    Layer 3 · reusable how-tos (PDF rendering, EPUB rendering, Windows packaging)
```

## How to work here

1. Read `CONTEXT.md` to find the right stage for the task.
2. Open that stage's `CONTEXT.md` and load **only** the files listed in its Inputs table.
3. Write results to that stage's `output/` folder (or to `app/` for Stage 03), using the file names in its Outputs table.
4. Stop at each review gate. The human may edit any output before the next stage reads it.
5. After any feature changes status, update `shared/feature-register.md`.

## Non-negotiable rules

- **Scope:** build only the v1 features in `shared/feature-register.md`. Write new ideas there as "later". Do not build them.
- **Offline and private:** no telemetry, no accounts, no network calls at runtime. Books never leave the computer.
- **Do not change the user's files:** never write to the user's PDF or EPUB files. Bookmarks, highlights, notes and reading positions are stored in the app's own data folder.
- **Simple UI:** single-page view, no page-turn animations, day and night themes. Follow `_config/design-system.md`.
- **Decisions:** any change to the stack or data model gets a dated entry in `shared/decisions-log.md`.
- **Honesty:** report which features you tested by hand, which you tested with automated tests, and which you did not test.

## v1 feature summary

Open PDF/EPUB · page navigation · zoom / font size · library (simple title list) · remember last page · bookmarks · single-page view · day/night mode · word search · clickable table of contents · highlights with attached notes · full screen · Windows installer.

## Related projects

None. This is unrelated to the Matematik Visual Learning projects; it only borrows their ICM folder convention.
