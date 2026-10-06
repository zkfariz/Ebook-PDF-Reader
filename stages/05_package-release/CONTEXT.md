# Stage 05 · Package & release

**Job:** Build a signed-off version into a Windows installer (`.exe`), check that it installs cleanly, and write the release notes.

## Inputs

| File | Layer | Why |
|---|---|---|
| `../04_test-review/output/test-report-vX.Y.Z.md` | 4 | Must say "ready" |
| `../../app/package.json` | 4 | Version and electron-builder config |
| `../../skills/windows-packaging.md` | 3 | How to build and the common pitfalls |
| `output/release-notes.md` | 4 | Previous notes, to add to |

## Process

1. Confirm that the test report is signed off. If it is not, stop and go back to Stage 04.
2. Bump the version in `app/package.json` (semver).
3. Run `npm run dist` → the NSIS installer is written to `app/release/`.
4. Install it on this PC: check the Start-menu shortcut, the app icon, opening a PDF and an EPUB, uninstalling, and whether user data is kept after a reinstall.
5. Copy the installer to `output/installers/` and add a section to `release-notes.md`.
6. Update the version and the release date in `shared/feature-register.md`.

## Outputs

| File | Location | Format |
|---|---|---|
| `Ebook-Reader-Setup-X.Y.Z.exe` | `output/installers/` | NSIS installer |
| `release-notes.md` | `output/` | Newest first: version, date, added / fixed / known issues |

## Audit

- [ ] The installer runs on a clean user account. The SmartScreen warning is expected because the app is unsigned; note this in the release notes.
- [ ] The installed app has no dev tools menu and no localhost URLs.
- [ ] Uninstalling removes the app but not the user's books.
