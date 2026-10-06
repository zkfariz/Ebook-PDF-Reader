# Tech stack (confirmed in Stage 02, 2026-10-04)

The full table with versions and reasons is in `stages/02_architecture/output/architecture.md` §1. This is the short form.

| Concern | Choice |
|---|---|
| Desktop shell | Electron ^44 |
| Build tooling | electron-vite ^5 + **Vite 7** (electron-vite does not support Vite 8 yet) |
| Language | TypeScript ^7 (type-check only; fallback TS 6) |
| UI | React ^19, `useReducer` + context (no state library) |
| PDF engine | pdfjs-dist ^6.4 |
| EPUB engine | **foliate-js ^1.0** (replaces epub.js, which is no longer maintained); fallback epubjs 0.3.93 |
| Validation | zod |
| Storage | JSON files in `userData`, atomic writes |
| Tests | Vitest ^5 (unit) · Playwright ^1.63 `_electron` (smoke) |
| Packaging | electron-builder ^26 → NSIS `.exe` |

Dev machine: Node 22.23 LTS, npm 10.9.
