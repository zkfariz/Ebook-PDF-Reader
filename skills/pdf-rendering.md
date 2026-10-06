# Skill · PDF rendering with PDF.js

- Use `pdfjs-dist`. Set `GlobalWorkerOptions.workerSrc` to the bundled worker (with Vite: `import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`).
- Render **one page at a time** to a `<canvas>`, scaled by `devicePixelRatio` so text stays sharp. Cancel the previous `renderTask` before starting a new one.
- Put a **text layer** (`TextLayer`) over the canvas for selection, search hits and highlights. Its scale must match the canvas viewport exactly.
- **TOC:** `pdf.getOutline()`; turn each `dest` into a page with `pdf.getPageIndex(ref)`. Named dests need `pdf.getDestination(name)` first.
- **Search:** pull text from each page with `page.getTextContent()`, cache it per page, and search it lazily. If a page has no text items, it is probably scanned: show "This page has no searchable text."
- **Highlights:** store `{page, startOffset, endOffset, text}` against the page's concatenated text, not pixel rectangles. Rebuild the rectangles from the text layer on every render, so highlights survive zoom.
- **Night mode:** invert the canvas with CSS only (see the design system). The highlight overlay stays un-inverted.
- **Passwords:** catch `PasswordException` and prompt for the password.
- **Memory:** call `page.cleanup()` on pages you leave, and `pdf.destroy()` when you close the book.
