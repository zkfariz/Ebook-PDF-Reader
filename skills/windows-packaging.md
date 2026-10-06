# Skill · Windows packaging with electron-builder

Configured in `app/package.json` → `"build"` (since S4).

- Commands: `npm run dist` → `release/Ebook-Reader-Setup-<version>.exe` (NSIS) **and** `release/win-unpacked/`. `npm run dist:dir` builds only the unpacked folder (faster, for smoke tests).
- Config: `appId: com.local.ebookreader`, `productName: Ebook Reader`, `files: ["out/**/*", "package.json"]`, `win.target: nsis`, NSIS `oneClick: false`, `allowToChangeInstallationDirectory: true`, `createStartMenuShortcut: true`, `deleteAppDataOnUninstall: false` (keeps the library, bookmarks and highlights), `artifactName: Ebook-Reader-Setup-${version}.${ext}`.
- **Dependencies:** only main-process runtime libraries (currently `zod`) go in `dependencies`; they are packed into `app.asar`. Renderer libraries (React, pdfjs-dist, foliate-js) are bundled by Vite, so keep them in `devDependencies` or they'll be packed twice.
- pdf.js assets (fonts, CMaps, wasm) come from `src/renderer/public/pdfjs` (copied on `npm install`) and end up in `out/renderer`, so they're inside the asar. The S4 smoke test confirmed that the packaged app renders PDFs.
- **Smoke-test the packaged app without installing:** launch `release/win-unpacked/Ebook Reader.exe` with Playwright (`_electron.launch({ executablePath })`) and set `EBOOK_READER_USER_DATA` to a temp folder.
- Icon: the user's logo. `build/icon-source.png` → `npm run icon` (`scripts/make-icon.cjs`, runs in Electron: square crop, transparent outside the circle, 512×512) → `build/icon.png`; `win.icon: "build/icon.png"` (electron-builder makes the .ico). Electron bitmaps are **premultiplied**: scale the colour channels with alpha, or transparency is lost. Check the result with PowerShell `[System.Drawing.Icon]::ExtractAssociatedIcon(exe)`.
- The app is unsigned, so Windows SmartScreen shows "Windows protected your PC" → "More info" → "Run anyway". This is expected for a personal app. (electron-builder logs "signing with signtool.exe", but with no certificate configured nothing is really signed.)
- Production builds: no menu, DevTools disabled (`webPreferences.devTools` is false when not in dev).
- Size: the installer is about 114 MB; the app code is about 13 MB, and the rest is the Electron runtime.
