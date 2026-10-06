# Release notes

Newest first.

## Ebook Reader 1.2.0 · 2026-10-06

**Installer:** `installers/Ebook-Reader-Setup-1.2.0.exe` (112.5 MB, Windows 10/11, 64-bit)
**SHA-256:** `7a081aacffa701e71a98957b843d558c15201c409fa8f7234260b39b797353a9`
**Tested:** `stages/04_test-review/output/test-report-v1.2.0.md` (100 automated end-to-end + 73 unit tests, 3 full runs; hand test by the user).

### New: read scanned PDFs (text recognition, "OCR")
Scanned PDFs, where every page is only a picture, can now be searched, highlighted and given notes.
- On a page that is only a picture, a notice offers **Recognise text** (this page) and **Recognise the whole book**.
- While a whole book is being read you can keep reading and turning pages. A progress count shows, with **Cancel**. After Cancel, or after quitting the app part-way, **Continue** reads only the pages that are still pictures.
- Recognised pages can be selected, highlighted, given notes and found by search, exactly like pages of a normal PDF. Search also offers **Recognise the whole book** when a book has no text yet.
- A blank page says "No text found on this page."
- **Private and offline, as always:** the recognition runs on your computer, only when you ask. The engine and the English language data are inside the installer, and nothing is downloaded or sent anywhere.
- **Your PDF is never changed.** Recognised text is saved separately in the app's data folder (one small file per book, removed when you remove the book from the library). Every page is saved as soon as it is read, so it is only ever read once.

### Good to know
- **English only** for now.
- **Mistakes are normal.** Typeset, clean scans read very well in our tests (99–100 % of the words on test pages). Hand-lettered, faded, skewed or noisy pages read much worse: on a hand-lettered, diagram-heavy page of a real book about 7 of 10 words were found. The app says "Recognised text may contain mistakes."
- **Speed and memory:** about 3–8 seconds per page. A 128-page scanned book took about 5½ minutes on an 8-core PC. While a whole book is being read the app can use about 1 GB of memory; it falls back to about half of that soon after it finishes.
- The installer is about 4 MB larger than 1.1.1.

### Install, update, uninstall
- Same as 1.0.2 (below). Updating from 1.1.1 keeps your library, bookmarks, highlights and notes.

### Known limitations
- Same as 1.1.1, 1.1.0 and 1.0.2 (below), except that scanned PDFs can now be read as described above.
- Not tested: scanned books of several hundred pages, PCs with little memory or few processor cores, and languages other than English.
- Pages that are rotated by 90° or 270° in the PDF file may have recognised text that is not lined up with the picture (not specifically tested).

## Ebook Reader 1.1.1 · 2026-10-06

**Installer:** `installers/Ebook-Reader-Setup-1.1.1.exe` (108.6 MB, Windows 10/11, 64-bit)
**SHA-256:** `fc68f2128b1e96fc37819905b84a24cd7c2551e5eb1bc53c665e18845a90694c`
**Tested:** `stages/04_test-review/output/test-report-v1.1.1.md` (88 automated end-to-end + 53 unit tests; hand test by the user).

### Fixed
- **Night mode in books with their own colours.** In some EPUBs, such as books from Project Gutenberg, the text stayed dark in night mode and was unreadable on the dark page (B004). Night mode now always shows light text. Day mode keeps the book's own colours.

### Known limitations
- Same as 1.1.0 and 1.0.2 (below). Also: pictures with a white background (such as decorative capital letters) stay white in night mode, and a book's tables or boxes that have their own light background may look odd in night mode.

## Ebook Reader 1.1.0 · 2026-10-06

**Installer:** `installers/Ebook-Reader-Setup-1.1.0.exe` (108.6 MB, Windows 10/11, 64-bit)
**SHA-256:** `f8e55a7b3a58836e15610b193d3e72e3a45b37d7f6acfe38937004282577a911`
**Tested:** `stages/04_test-review/output/test-report-v1.1.0.md` (87 automated end-to-end + 53 unit tests, 3 full runs; hand test H1–H6 by the user).

### New
- **Open books from File Explorer.** Right-click a PDF or EPUB → *Open with* → **Ebook Reader**. Once you've chosen it with *Always*, a double-click works too.
  - The book opens straight away, at the page where you left off.
  - If Ebook Reader is already open, the book opens in the **same window**, which comes to the front (even when minimised). If it's the book you're already reading, you stay on your page.
  - A missing, damaged or non-book file shows the usual plain message.
- **Your default apps are left alone.** The installer only *offers* Ebook Reader for .pdf and .epub. The first time you double-click one, Windows may ask which app to use; nothing changes unless you choose. You can also pick it in Settings → Apps → Default apps.

### Changed
- Only one Ebook Reader window runs at a time. Starting the app again brings the open window to the front.

### Install, update, uninstall
- Same as 1.0.2 (below). Updating from 1.0.2 keeps your library, bookmarks, highlights and notes. Uninstalling also removes Ebook Reader from *Open with*.

### Known limitations
- Same as 1.0.2 (below). Also: "Open with" was hand-tested with the default "just me" install, not with "install for all users".

## Ebook Reader 1.0.2 · 2026-10-06 · first release

**Installer:** `installers/Ebook-Reader-Setup-1.0.2.exe` (108.6 MB, Windows 10/11, 64-bit)
**SHA-256:** `7729cc4217e9935b9d4950f997dfc882904aa1a2c4a389f9ec71cb04f8562f80`
**Tested:** `stages/04_test-review/output/test-report-v1.0.2.md` (all spec criteria; 82 automated end-to-end + 46 unit tests; hand test by the user).

A calm, offline reader for PDF and EPUB books.

### What it does
- **Open books**: PDF and EPUB, with Ctrl+O, *Open book…*, or by dragging a file onto the window. Password-protected PDFs ask for the password (never saved). Damaged and copy-protected (DRM) files get a plain message.
- **Library**: every book you opened, newest first, with author, type, last opened and progress. ✕ removes a book from the list (and its bookmarks, highlights and notes); **the book file itself is never touched**. Moved or renamed books are recognised by their content; a missing file offers *Locate file…*.
- **Picks up where you left off**: position, zoom (PDF) and text size (EPUB) are remembered per book, even after a crash.
- **Reading**: one page at a time, no animations. ← → / PgUp PgDn / Space / Home End / mouse wheel; page or location box (Ctrl+G). PDF zoom 50–400 %, fit width / fit page (Ctrl + − 0, Ctrl+wheel). EPUB text size 14–28 px and Serif/Sans (A− A+, Ctrl+wheel).
- **Day and night mode** (☾ / ☀, Ctrl+Shift+N). The first start follows Windows. In night mode PDF pages are inverted and EPUB text is light on dark.
- **Full screen** (F11 or ⛶; Esc leaves). The toolbar appears when the mouse touches the top edge.
- **Sidebar** (☰ or Ctrl+\\) with four tabs:
  - **Contents**: clickable table of contents, current chapter highlighted.
  - **Bookmarks** (Ctrl+B or ☆): in book order, labelled with chapter and page or %.
  - **Highlights**: select text → 4 colours, **Copy**, **Note**. Click a highlight to recolour, add or edit its note, or delete it. Notes show a small ✎ in the text and a tooltip on hover.
  - **Search** (Ctrl+F): whole book, ignores capital letters and accents; Enter / Shift+Enter step through the results.
- **Private and offline**: no internet connection is ever made, nothing is sent anywhere, and there is no account.

### Fixed since the test builds
- **1.0.1**: a dark frame around EPUB text after switching from night to day mode (B002, found in the hand test).
- **1.0.2**: the mouse wheel now turns EPUB pages, and Ctrl+wheel changes the text size (B003, found in the hand test).

### Install, update, uninstall
- **Install:** run the installer. Windows may say *"Windows protected your PC"* because the app isn't signed by a publisher: click **More info → Run anyway**. You can choose the install folder; the app appears in the Start menu as **Ebook Reader**.
- **Update:** close the app and run the newer installer; it replaces the app and keeps your data.
- **Uninstall:** Settings → Apps → Ebook Reader → Uninstall. Your library, bookmarks, highlights and notes are **kept** (in `%APPDATA%\Ebook Reader`) and come back if you reinstall. To remove them too, delete that folder.

### Known limitations
- **Scanned PDFs** (pages that are only pictures) can't be searched or highlighted; the app says so.
- **Chinese/Japanese/Korean books** haven't been tested. Right-to-left (Arabic) books were tested and work.
- In **right-to-left books**, → still means "forward in the book" (later idea L07).
- **Links to websites** inside books do nothing (the app works offline only).
- Clicking into the page while the note box is open closes it **without saving** (the same as Cancel).
- Two bookmarks in the same long chapter can have very similar labels (later idea L06).
- The installer is **unsigned** (SmartScreen warning, see above).
- Tested on one Windows account (the developer's own PC); not yet on a second, clean account.
