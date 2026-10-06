# Skill · EPUB rendering with foliate-js

Package: `foliate-js` 1.0.1 (MIT, the engine behind the Foliate reader). It is ES modules with no build step and no types. Our narrow type declarations are in `app/src/renderer/reader/epub/foliate.d.ts`. Importing `foliate-js/view.js` registers `<foliate-view>`. The implementation is `app/src/renderer/reader/epub/EpubAdapter.ts`.

## Opening and layout
- `makeBook(new File([bytes], 'book.epub'))` parses the book (zip.js is bundled in `foliate-js/vendor/zip.js`). Throws on a corrupt zip.
- `view.open(book)`, then set the renderer attributes **before** `view.init({})`: `flow="paginated"`, `max-column-count="1"` (single page), `max-inline-size="680px"`, `margin`, `gap`. Never set `animated` (no page-turn animation).
- **Wait for the layout to settle after `init()`.** foliate lays the first section out again about 200 ms later (font load etc.), and a page turn in that gap is undone. `EpubAdapter.mount()` resolves only after 300 ms without a `relocate` event.
- **Don't change the pane's size after mounting.** A resize re-lays out and snaps back to the anchor. That's why the EPUB status bar is always rendered.

## Progress
- `relocate` event → `detail.location.{current,total}` (**`current` is 0-based**, about 1,500 chars per location), `detail.fraction`, `detail.cfi`, `detail.tocItem`. Show `Location {current+1} of {total} · {round(fraction·100)}%`.
- `view.renderer.atStart` / `atEnd` for the ◀ ▶ buttons.
- Jump to location N: `view.goToFraction((N-1)/total)`. The screen starts at or just before N.
- First/last page: `renderer.goTo({ index, anchor: 0 | 1 })` with the first/last linear section.

## Navigation gotcha
- The paginator ignores navigation for about 100 ms after each page turn (`#locked`). The adapter **queues** navigation (max one waiting) so quick double presses aren't lost and holding a key doesn't overshoot.

## Security (verified in the S3 trial)
- Section iframes use `sandbox="allow-same-origin allow-scripts"` (Chromium logs a harmless "can escape its sandboxing" warning). **What actually blocks book scripts is our CSP**, which `blob:` section documents inherit from the app page: `script-src 'self'` blocks inline and blob scripts. Never add `'unsafe-inline'` or `blob:` to `script-src`.
- `style-src` must include `blob:` (books' own CSS is loaded as blob URLs). `img-src`/`font-src` include `blob:` + `data:`. Remote images are refused by CSP before any request is sent.
- Main process: `will-frame-navigate` blocks sub-frames from navigating anywhere except `blob:`/`about:blank`.
- `external-link` events are cancelled (links to the web do nothing in v1).

## Input inside the book
- Each section is its own iframe. On the `load` event, forward `keydown` to `window` as a cancelable synthetic event (call `preventDefault()` on the original if the app handled it). Forward `drop` too, and prevent `dragover`.
- In Playwright, **don't** `frame.locator('body').click()`: it scrolls the section to its start. Use `page.mouse.click()` on the visible page instead.

## Text size and themes
- `view.renderer.setStyles(css)` is re-applied by foliate to every section. Build it from the design tokens (`--ink`, `--page`, `--accent`) plus `font-size` and `font-family` with `!important`. S5 calls it again on theme change.

## Still to use in later slices
- TOC: `view.book.toc` → `[{label, href, subitems}]` → `view.goTo(href)` (S6).
- Search: `view.search({ query, matchCase:false, matchDiacritics:false })` async generator; `view.clearSearch()` (S8).
- Highlights: `view.addAnnotation({ value: cfiRange, color })` + `draw-annotation` → `Overlayer.highlight`; `show-annotation` on click (S9). CFI compare: `foliate-js/epubcfi.js`.
- DRM: done in `epub/drm.ts` (encryption.xml with anything other than font obfuscation ⇒ DRM).
