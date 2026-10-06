# Decisions log

Newest first. Each entry gives the date, the decision, why, and the alternatives considered.

## 2026-10-06 · Release v1.1.1 (Stage 05)
- **Patch release for B004** (night-mode text in EPUBs with their own colours). Released exactly as tested (1.1.1, SHA-256 `fc68f212…a90694c`), no further bump.
- **Night mode overrides every text colour inside an EPUB** (links keep the accent colour). Alternative: only fix the body colour. Rejected because books also colour paragraphs and headings (the test book does), and dark-on-dark text is the worse failure than losing a book's coloured headings at night. Day mode keeps the book's own colours.

## 2026-10-06 · Release v1.1.0 (Stage 05)
- **Released 1.1.0 exactly as tested; no further bump** (same reasoning as 1.0.2). The version was set to 1.1.0 in Stage 03 so the hand-tested installer is the release. SHA-256 `f8e55a7b…2577a911`.
- **Stage 05 step 4 (install on this PC) was the user's hand test H1–H6**, done on the same installer.

## 2026-10-06 · F15 "Open with" (v1.1.0)
- **Offer only, never take over the default** (spec Q7, chosen by the user). Windows 10/11 don't allow an installer to set a default app silently anyway.
- **The registry entries are written by our own installer script (`app/build/installer.nsh`), not by electron-builder's `fileAssociations`.** Its built-in macro also sets the extension's default value (`.pdf` → our app) and doesn't restore it on uninstall, which could take over `.pdf` on some PCs and leave a broken association behind. We write only "offer" keys: a ProgID per type, `OpenWithProgids`, and Capabilities + RegisteredApplications (so the app shows in Settings → Default apps). Uninstall removes exactly these.
- **Single instance** (`app.requestSingleInstanceLock`): a second start hands its command line to the running app (via `additionalData`, with `argv` as fallback) and exits. The lock is per data folder, so parallel test instances don't collide. Alternative: a new window per book. Rejected because the app is single-window by design.
- **Main holds the requested path; the page pulls it** (`files.takeOpenRequest`, plus an `openRequested` event). A book passed at start-up is therefore never lost, even if it arrives before the page has loaded. No data-model change.
- **Opening the book that is already on screen does nothing** (the page stays where you are); any other book replaces it in the same window.

## 2026-10-06 · Release v1.0.2 (Stage 05)
- **Released 1.0.2 exactly as tested; no version bump in Stage 05.** Stage 05 step 2 says to bump the version, but the build the user hand-tested and signed off is 1.0.2. Bumping would have produced a new, untested installer. Identity of the release: SHA-256 `7729cc42…f562f80` (full hash in the release notes).
- The installer is archived in `stages/05_package-release/output/installers/` (ignored by git: 108 MB binaries don't belong in the repo; it can be rebuilt from tag `v1.0.2` with `npm run dist`).

## 2026-10-06 · S10–S11 decisions
- **Notes**: the note text is passed to the adapters with each highlight, for the ✎ marker and the hover tooltip. Tooltips work by hit-testing (PDF marks layer and EPUB overlay can't take the mouse).
- **App icon = the user's own logo** (supplied 2026-10-06), made round and transparent by a script, so it can be regenerated from `build/icon-source.png`.
- **Version 1.0.0** for the first installer meant for real use.

## 2026-10-05 · S9 build decisions
- **Highlights are drawn in a layer of their own, never into the page image.** PDF: boxes in a marks layer under pdf.js's text layer, blended with `multiply` (day) / `screen` (night) so the text stays readable and night inversion doesn't affect them. EPUB: foliate's annotation overlay with the same blend via its CSS variables.
- **Copy goes through main** (`clipboard:writeText`, validated, ≤ 1 MB): the renderer keeps all browser permissions denied.
- **The reader exposes `data-ready`.** It's an explicit "ready for input" signal; tests must wait for it instead of guessing from overlays.
- **Sidebar tabs size to their labels** and the sidebar clips, so a 4th tab fits in 280 px without cutting text.

## 2026-10-05 · S5 build decisions
- **Full screen is controlled by main** (`win.setFullScreen` + enter/leave events), as in architecture §4. Tried the browser Fullscreen API first (simpler, built-in Esc), but its request never completed in this Electron setup. Esc is now in the keymap.
- **`nativeTheme.themeSource` follows the app theme**, so Chromium's own UI and `prefers-color-scheme` (which foliate-js reads) match night/day mode even when Windows is set the other way.
- **The theme is applied before React renders** to avoid a flash of the wrong colours on start-up.

## 2026-10-05 · S4 build decisions
- **The JSON store keeps each file in memory after the first load.** Main is the only writer, so this removes read-modify-write races (two quick saves can't overwrite each other) and makes reads instant.
- **Only main-process runtime libraries are `dependencies`** (currently just `zod`). React, pdf.js and foliate-js are bundled into the renderer by Vite, so they're devDependencies and aren't packed twice.
- **Test isolation via `EBOOK_READER_USER_DATA`.** Each e2e test uses a fresh data folder and never touches the user's real library.
- **Window bounds are saved at the start of quitting** as well as on window close (Electron fires `before-quit` before windows close).
- The early packaging check uses the unpacked build (`release/win-unpacked`) rather than running the installer, so testing doesn't install anything on the PC. The real install test is a hand test in S11.

## 2026-10-04 · S3 trial result: foliate-js confirmed
- **The trial passed all four conditions**, so foliate-js stays and the epub.js fallback is not needed: (a) single-column paginated ✔ (b) relocate gives location + CFI ✔ (c) EPUB `<script>` does not run ✔ (blocked by our CSP, inherited by the blob: section frames) (d) keys inside the book text reach the app ✔ (forwarded from the iframe).
- **CSP `style-src` now allows `blob:`.** Books' own stylesheets are loaded as blob URLs and were being blocked. Scripts stay strictly `'self'`.
- **Sub-frame navigation is restricted** to `blob:`/`about:blank` (`will-frame-navigate`).
- **`ReaderAdapter.mount()` now returns a Promise** that resolves when the first page is really on screen (and, for EPUB, foliate's layout has settled). The reader accepts keys only after that, so no early key press is lost.
- Links to the web inside books do nothing in v1 (not a v1 feature; would need a confirm-and-open-browser flow).

## 2026-10-04 · S1 build decisions
- **Production UI served from a private `app://bundle/` protocol instead of `file://`.** pdf.js 6 loads its worker as an ES module and fetches fonts/wasm, which Chromium blocks or restricts on the opaque `file://` origin. A privileged standard scheme fixes this and follows Electron's security checklist. Requests outside the renderer folder are rejected (403).
- **pdf.js runtime assets are copied into the app at `npm install`** (not loaded from a CDN), so the app stays offline.
- **Test PDFs are generated by our own script** (including an RC4 password-protected one), so no third-party files are needed in the repo.

## 2026-10-04 · Architecture (Stage 02)
- **EPUB engine: foliate-js 1.0.1 instead of epub.js.** epub.js's last stable release is 0.3.93 and it has only had alphas since 2023. foliate-js is maintained, MIT-licensed, on npm, single-page paginated, has built-in location counts (no slow generation), and supports search, CFI and annotations. It is less widely used, so S3 starts with a spike, with epub.js 0.3.93 as the fallback.
- **Vite pinned to 7** (and @vitejs/plugin-react 5): electron-vite 5.0 supports only Vite ≤ 7. Considered dropping electron-vite, but it saves a lot of config.
- **TypeScript 7** for type-checking only; fall back to 6 if a tool breaks.
- **Book identity = SHA-256 of the whole file**, so a book survives renames and moves. An edited file counts as a new book (with a "Locate file" re-key option).
- **Storage: one JSON file per book** + library.json + settings.json, with atomic writes and zod validation. SQLite was rejected as unnecessary at this scale.
- **Locations:** PDF `pdf:p=N` and highlights as page + text offsets (+ stored text for repair); EPUB uses CFI. No pixels are stored.
- **Offline enforcement** in code: main blocks every non-local request.
- **Book bytes go over IPC as an ArrayBuffer.** A streaming protocol is deferred.

## 2026-10-04 · Spec answers (Stage 01)
- **EPUB progress** is shown as "Location N of M · %". It is accurate and does not change with window size; estimated page numbers were rejected because they are only approximate.
- **4 highlight colours** (yellow default, green, blue, pink).
- **The app starts on the library**, not the last book.
- **The interface is in English only.** A BM option was considered but adds translation work to every screen.

## 2026-10-04 · Project set up
- **Desktop app (Electron), not a hosted web app.** The user chose an installable Windows app. Electron keeps the web UI so the app can also run in a browser for development.
- **Formats: PDF + EPUB** from v1.
- **v1 scope is limited to the basics** listed in `feature-register.md`: single page, no animations, day/night mode, simple title list, basic search, TOC, and highlights with notes.
- The stack in `_config/tech-stack.md` is still a **proposal** until Stage 02 confirms it.
