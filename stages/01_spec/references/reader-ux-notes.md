# Reader UX notes (reference)

Common conventions in desktop ebook/PDF readers (Adobe Reader, SumatraPDF, Calibre viewer, Foliate, Thorium) that users will expect:

- **Open:** Ctrl+O, drag a file onto the window, or open it from the library list.
- **Navigate:** ←/→ and PgUp/PgDn change page; Home/End go to the first/last page; a page box ("12 / 340") lets you type a page number.
- **Zoom (PDF):** Ctrl + / Ctrl −, Ctrl+0 resets; "Fit width" and "Fit page" buttons.
- **Text size (EPUB):** A− / A+ instead of zoom, because EPUB text reflows.
- **Contents:** a collapsible tree in the left sidebar; clicking an entry jumps there.
- **Search:** Ctrl+F opens the search box; results are listed with a text snippet and page number; Enter and Shift+Enter move to the next and previous match.
- **Bookmarks:** Ctrl+B toggles a bookmark on the current page; bookmarks are listed in the sidebar.
- **Highlights:** select text, a small popup appears with Highlight / Add note; highlights are listed in the sidebar.
- **Night mode:** dark background with light text. For PDFs, invert the page colours with a CSS filter that preserves hue, so images still look reasonable.
- **Full screen:** F11; Esc exits.
- **Resume:** reopening a book returns to the last position automatically.
