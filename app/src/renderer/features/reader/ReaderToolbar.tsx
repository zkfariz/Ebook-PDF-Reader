import { forwardRef, useEffect, useState, type KeyboardEvent } from 'react'
import type { BookFormat, Theme } from '@shared/ipc'
import { ThemeButton } from '../../ui/ThemeButton'
import type { EpubFont, PdfZoom, Progress, ViewState } from '../../reader/ReaderAdapter'

interface ReaderToolbarProps {
  title: string
  format: BookFormat
  progress: Progress | null
  view: ViewState | null
  onLibrary: () => void
  onPrev: () => void
  onNext: () => void
  onGoTo: (n: number) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onPdfZoom: (zoom: PdfZoom) => void
  onEpubFont: (font: EpubFont) => void
  theme: Theme
  onToggleTheme: () => void
  fullscreen: boolean
  onToggleFullscreen: () => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
  bookmarked: boolean
  onToggleBookmark: () => void
  onSearch: () => void
}

/** Toolbar for the reading screen. The page box ref lets Ctrl+G focus it. */
export const ReaderToolbar = forwardRef<HTMLInputElement, ReaderToolbarProps>(function ReaderToolbar(
  {
    title,
    format,
    progress,
    view,
    onLibrary,
    onPrev,
    onNext,
    onGoTo,
    onZoomIn,
    onZoomOut,
    onPdfZoom,
    onEpubFont,
    theme,
    onToggleTheme,
    fullscreen,
    onToggleFullscreen,
    sidebarOpen,
    onToggleSidebar,
    bookmarked,
    onToggleBookmark,
    onSearch
  },
  pageBoxRef
) {
  const [pageText, setPageText] = useState('')
  const current = progress ? String(progress.current) : ''
  useEffect(() => setPageText(current), [current])
  const unit = format === 'pdf' ? 'page' : 'location'

  const submitPage = () => {
    const n = Number(pageText)
    // Invalid input (0, text, > total) simply resets the box (F02.3).
    if (progress && Number.isInteger(n) && n >= 1 && n <= progress.total) onGoTo(n)
    else setPageText(current)
  }

  const onPageKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      submitPage()
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setPageText(current)
      e.currentTarget.blur()
    }
  }

  return (
    <header className="toolbar">
      <button
        onClick={onToggleSidebar}
        aria-label="Sidebar"
        aria-expanded={sidebarOpen}
        title={`${sidebarOpen ? 'Hide' : 'Show'} sidebar (Ctrl+\\)`}
      >
        ☰
      </button>
      <button onClick={onLibrary} title="Back to library (Alt+←)">
        ⟵ Library
      </button>
      <span className="title" title={title}>
        {title}
      </span>

      {progress && (
        <div className="tool-group" aria-label="Navigation">
          <button onClick={onPrev} disabled={progress.atStart} title="Previous page (←)" aria-label="Previous page">
            ◀
          </button>
          <input
            ref={pageBoxRef}
            className="page-box"
            aria-label={format === 'pdf' ? 'Page number' : 'Location number'}
            title={`Go to ${unit} (Ctrl+G)`}
            inputMode="numeric"
            value={pageText}
            onChange={(e) => setPageText(e.target.value)}
            onKeyDown={onPageKey}
            onBlur={() => setPageText(current)}
            onFocus={(e) => e.currentTarget.select()}
          />
          <span className="page-total">/ {progress.total}</span>
          <button onClick={onNext} disabled={progress.atEnd} title="Next page (→)" aria-label="Next page">
            ▶
          </button>
        </div>
      )}

      {view?.kind === 'pdf' && (
        <div className="tool-group" aria-label="Zoom">
          <button onClick={onZoomOut} title="Zoom out (Ctrl −)" aria-label="Zoom out">
            −
          </button>
          <span className="zoom-label" aria-label="Zoom level">
            {view.percent}%
          </span>
          <button onClick={onZoomIn} title="Zoom in (Ctrl +)" aria-label="Zoom in">
            +
          </button>
          <button
            onClick={() => onPdfZoom('fit-width')}
            aria-pressed={view.zoom === 'fit-width'}
            title="Fit width"
            aria-label="Fit width"
          >
            ⇔
          </button>
          <button
            onClick={() => onPdfZoom('fit-page')}
            aria-pressed={view.zoom === 'fit-page'}
            title="Fit page (Ctrl+0)"
            aria-label="Fit page"
          >
            ▣
          </button>
        </div>
      )}

      {view?.kind === 'epub' && (
        <div className="tool-group" aria-label="Text">
          <button onClick={onZoomOut} title="Smaller text (Ctrl −)" aria-label="Smaller text">
            A−
          </button>
          <span className="zoom-label" aria-label="Text size">
            {view.fontSize}px
          </span>
          <button onClick={onZoomIn} title="Larger text (Ctrl +)" aria-label="Larger text">
            A+
          </button>
          <button
            onClick={() => onEpubFont(view.fontFamily === 'serif' ? 'sans' : 'serif')}
            title="Switch between serif and sans-serif font"
            aria-label="Font"
          >
            {view.fontFamily === 'serif' ? 'Serif' : 'Sans'}
          </button>
        </div>
      )}

      <div className="tool-group">
        <button onClick={onSearch} aria-label="Search" title="Search in book (Ctrl+F)">
          🔍
        </button>
        <button
          className={bookmarked ? 'bookmark-toggle on' : 'bookmark-toggle'}
          onClick={onToggleBookmark}
          aria-label="Bookmark this page"
          aria-pressed={bookmarked}
          title={`${bookmarked ? 'Remove bookmark' : 'Bookmark this page'} (Ctrl+B)`}
        >
          {bookmarked ? '★' : '☆'}
        </button>
        <ThemeButton theme={theme} onToggle={onToggleTheme} />
        <button
          onClick={onToggleFullscreen}
          aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
          title={fullscreen ? 'Exit full screen (F11 or Esc)' : 'Full screen (F11)'}
        >
          ⛶
        </button>
      </div>
    </header>
  )
})
