import type { EpubFont } from '../ReaderAdapter'

export const FONT_SIZE = { min: 14, max: 28, step: 2, default: 18 }

const FONT_STACKS: Record<EpubFont, string> = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
}

/**
 * Reading styles for the book text, from the current design tokens (they change with the
 * theme, F08.3) plus the reader's text size and font (F03). foliate applies them to every section.
 */
export function bookStyles(fontFamily: EpubFont, fontSize: number): string {
  const tokens = getComputedStyle(document.documentElement)
  const t = (name: string) => tokens.getPropertyValue(name).trim()
  const night = document.documentElement.dataset['theme'] === 'night'
  return `
    html {
      color: ${t('--ink')} !important;
      background: ${t('--page')} !important;
      /* foliate paints the page margins with the background it saw when the chapter loaded;
         this variable makes it repaint them on every style change (theme switch). */
      --theme-bg-color: ${t('--page')};
    }
    /* Many books (e.g. Project Gutenberg) set their own colours on body (black on white). Without
       this the book's body rule beats the colour inherited from html and night mode is unreadable. */
    body { font-family: ${FONT_STACKS[fontFamily]} !important; font-size: ${fontSize}px !important;
      color: ${t('--ink')} !important; background: transparent !important; }
    /* In night mode every text colour in the book is replaced, so dark text can't vanish on the dark page. */
    ${night ? "body :not(a):not(svg):not(svg *) { color: inherit !important; }" : ''}
    p, li, blockquote, dd { line-height: 1.6 !important; }
    a:any-link { color: ${t('--accent')} !important; }
    * { transition: none !important; animation: none !important; }
  `
}
