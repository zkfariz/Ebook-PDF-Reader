import { useCallback, useEffect, useRef, useState } from 'react'
import type { Theme } from '@shared/ipc'
import type { OpenedBook } from '../../app/openBook'
import type { SidebarState } from '../../app/theme'
import { Sidebar } from '../../ui/Sidebar'
import { TocTree } from '../toc/TocTree'
import { BookmarkList } from '../bookmarks/BookmarkList'
import { useBookmarks } from '../bookmarks/useBookmarks'
import { SearchPanel } from '../search/SearchPanel'
import { useSearch } from '../search/useSearch'
import { anchorLoc, useHighlights } from '../highlights/useHighlights'
import { HighlightList } from '../highlights/HighlightList'
import { HighlightPopup, type PopupState } from '../highlights/HighlightPopup'
import { OcrNotice } from '../ocr/OcrNotice'
import { useOcr } from '../ocr/useOcr'
import { useFullscreen } from './useFullscreen'
import { matchShortcut, type ShortcutAction } from '../../app/keymap'
import { Dialog } from '../../ui/Dialog'
import {
  ReaderError,
  type Loc,
  type Progress,
  type TocItem,
  type ReaderAdapter,
  type ViewSettings,
  type ViewState
} from '../../reader/ReaderAdapter'
import { PdfAdapter } from '../../reader/pdf/PdfAdapter'
import { EpubAdapter, FONT_SIZE } from '../../reader/epub/EpubAdapter'
import { ReaderToolbar } from './ReaderToolbar'
import { BookSession } from './BookSession'
import './reader.css'

interface ReaderScreenProps {
  book: OpenedBook
  theme: Theme
  onToggleTheme: () => void
  sidebar: SidebarState
  onSidebarChange: (next: SidebarState) => void
  onClose: () => void
  onFatalError: (message: string) => void
}

type Phase = { kind: 'opening' } | { kind: 'password'; wrong: boolean } | { kind: 'ready' }

export function ReaderScreen({
  book,
  theme,
  onToggleTheme,
  sidebar,
  onSidebarChange,
  onClose,
  onFatalError
}: ReaderScreenProps) {
  const paneRef = useRef<HTMLDivElement>(null)
  const pageBoxRef = useRef<HTMLInputElement>(null)
  const adapterRef = useRef<ReaderAdapter | null>(null)
  const sessionRef = useRef<BookSession | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'opening' })
  const [title, setTitle] = useState(stripExtension(book.fileName))
  const [progress, setProgress] = useState<Progress | null>(null)
  const [view, setView] = useState<ViewState | null>(null)
  const [password, setPassword] = useState('')
  const [toc, setToc] = useState<TocItem[] | null>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme
  const { fullscreen, toolbarShown, toggleFullscreen, exitFullscreen, onPointerMove } = useFullscreen()
  const marks = useBookmarks(book.format, adapterRef, sessionRef, progress, toc)
  const search = useSearch(adapterRef)
  const hl = useHighlights(adapterRef, sessionRef)
  const ocr = useOcr(adapterRef, book.bookId, progress)
  const [popup, setPopup] = useState<PopupState | null>(null)
  const [searchFocus, setSearchFocus] = useState(0)

  const tryOpen = async (pw?: string) => {
    const adapter = adapterRef.current
    if (!adapter) return
    setPhase({ kind: 'opening' })
    try {
      const meta = await adapter.open(book.data, { password: pw })
      const session = sessionRef.current!
      await session.ready
      if (adapterRef.current !== adapter) return // closed or replaced meanwhile
      if (meta.title) setTitle(meta.title)
      session.recordOpened(meta, stripExtension(book.fileName))
      marks.load()
      hl.load()
      // Pages recognised earlier (F16): their text is used from the first page on.
      if (adapter.ocr) adapter.ocr.load((await window.api.ocr.get(book.bookId)).pages)
      const saved = session.savedView
      if (saved) await adapter.setView(saved)
      adapter.setTheme(themeRef.current)
      // Reopen where the reader left off (F05); the first page is on screen after this.
      await adapter.mount(paneRef.current!, session.position)
      if (adapterRef.current !== adapter) return
      paneRef.current!.focus() // so ↑/↓ scroll the page straight away
      setPhase({ kind: 'ready' })
      const toc = await adapter.getToc()
      if (adapterRef.current === adapter) setToc(toc)
    } catch (err) {
      if (adapterRef.current !== adapter) return
      if (err instanceof ReaderError && (err.kind === 'password-required' || err.kind === 'wrong-password')) {
        setPassword('')
        setPhase({ kind: 'password', wrong: err.kind === 'wrong-password' })
      } else if (err instanceof ReaderError && err.kind === 'drm') {
        onFatalError("This book is copy-protected (DRM) and can't be opened.")
      } else {
        onFatalError('This file could not be opened. It may be damaged.')
      }
    }
  }

  useEffect(() => {
    const adapter: ReaderAdapter = book.format === 'pdf' ? new PdfAdapter() : new EpubAdapter()
    const session = new BookSession(book)
    adapterRef.current = adapter
    sessionRef.current = session
    let lastLoc = ''
    const offs = [
      adapter.on('relocate', (p) => {
        setProgress(p)
        session.savePosition(p)
        // A real page change closes the selection popup. (foliate also re-reports the same
        // position, e.g. when the first click focuses the book: that must not close it.)
        if (p.loc !== lastLoc) setPopup(null)
        lastLoc = p.loc
      }),
      // Selecting text and clicking highlights (F11).
      adapter.on('select', (selection) => setPopup(selection ? { kind: 'new', selection } : null)),
      adapter.on('highlight-click', ({ id, rect }) => setPopup({ kind: 'existing', id, rect })),
      adapter.on('select-error', ({ message, rect }) => setPopup({ kind: 'error', message, rect })),
      adapter.on('highlight-repaired', ({ id, anchor }) => hl.repaired(id, anchor)),
      adapter.on('highlight-missing', ({ id }) => hl.notFound(id)),
      adapter.on('view', (v) => {
        setView(v)
        session.saveView(v)
      })
    ]
    void tryOpen()
    return () => {
      offs.forEach((off) => off())
      adapterRef.current = null
      adapter.destroy()
    }
  }, [book]) // reopen only when the book changes

  const toggleSidebar = useCallback(() => onSidebarChange({ ...sidebar, open: !sidebar.open }), [sidebar, onSidebarChange])

  /** Ctrl+F / 🔍 (F09): open the Search tab with the keyboard in the search box. */
  const openSearch = useCallback(() => {
    onSidebarChange({ open: true, tab: 'search' })
    setSearchFocus((n) => n + 1)
  }, [onSidebarChange])

  /** TOC / bookmark click (F10.2, F06.2): go there, then give the keyboard back to the page. */
  const goToTocEntry = (target: Loc) => {
    void adapterRef.current?.goTo(target)
    paneRef.current?.focus()
  }

  // Day/night switched while reading (F08.1).
  useEffect(() => adapterRef.current?.setTheme(theme), [theme])

  // Reading shortcuts (keymap.ts). Ctrl+O and Ctrl+Shift+N are handled by App.
  useEffect(() => {
    if (phase.kind !== 'ready') return
    const run: Partial<Record<ShortcutAction, (e: KeyboardEvent) => void>> = {
      library: () => onClose(),
      next: () => void adapterRef.current?.next(),
      prev: () => void adapterRef.current?.prev(),
      first: () => void adapterRef.current?.first(),
      last: () => void adapterRef.current?.last(),
      goto: () => pageBoxRef.current?.focus(),
      'zoom-in': () => void adapterRef.current?.zoomIn(),
      'zoom-out': () => void adapterRef.current?.zoomOut(),
      'zoom-reset': () => void adapterRef.current?.setView(defaultView(view)),
      fullscreen: () => toggleFullscreen(),
      escape: () => {
        if (popup) {
          adapterRef.current?.clearSelection()
          setPopup(null)
        } else exitFullscreen() // F13.2
      },
      'toggle-sidebar': () => toggleSidebar(),
      bookmark: () => marks.toggle(),
      search: () => openSearch()
    }
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return
      const action = matchShortcut(e)
      if (!action) return
      const adapter = adapterRef.current
      // ↑/↓ scroll normally; only at the page edge do they turn the page (spec shortcut table).
      if (action === 'down-or-next' || action === 'up-or-prev') {
        const down = action === 'down-or-next'
        if (adapter && adapter.isAtEdge(down ? 'bottom' : 'top')) {
          e.preventDefault()
          void (down ? adapter.next() : adapter.prev())
        }
        return
      }
      const handler = run[action]
      if (handler) {
        e.preventDefault()
        handler(e)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase.kind, onClose, view, toggleFullscreen, exitFullscreen, toggleSidebar, marks, openSearch, popup])

  return (
    <div
      className={['reader', fullscreen && 'fullscreen', toolbarShown && 'show-toolbar'].filter(Boolean).join(' ')}
      onPointerMove={onPointerMove}
      data-ready={phase.kind === 'ready'} // the book is on screen and accepts input (also used by tests)
    >
      <ReaderToolbar
        ref={pageBoxRef}
        title={title}
        format={book.format}
        progress={progress}
        view={view}
        onLibrary={onClose}
        onPrev={() => void adapterRef.current?.prev()}
        onNext={() => void adapterRef.current?.next()}
        onGoTo={(n) => void adapterRef.current?.goToNumber(n)}
        onZoomIn={() => void adapterRef.current?.zoomIn()}
        onZoomOut={() => void adapterRef.current?.zoomOut()}
        onPdfZoom={(zoom) => void adapterRef.current?.setView({ pdf: { zoom } })}
        onEpubFont={(fontFamily) =>
          view?.kind === 'epub' && void adapterRef.current?.setView({ epub: { fontSize: view.fontSize, fontFamily } })
        }
        theme={theme}
        onToggleTheme={onToggleTheme}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
        sidebarOpen={sidebar.open}
        onToggleSidebar={toggleSidebar}
        bookmarked={marks.isBookmarked}
        onToggleBookmark={marks.toggle}
        onSearch={openSearch}
      />

      <div className="reader-body">
        {sidebar.open && (
          <Sidebar
            active={sidebar.tab}
            onSelect={(tab) => onSidebarChange({ ...sidebar, tab })}
            tabs={[
              {
                id: 'contents',
                label: 'Contents',
                content: <TocTree items={toc} currentId={progress?.tocId} onSelect={goToTocEntry} />
              },
              {
                id: 'bookmarks',
                label: 'Bookmarks',
                content: <BookmarkList bookmarks={marks.bookmarks} onSelect={goToTocEntry} onDelete={marks.remove} />
              },
              {
                id: 'highlights',
                label: 'Highlights',
                content: (
                  <HighlightList
                    highlights={hl.highlights}
                    missing={hl.missing}
                    describe={(h) => adapterRef.current?.describe(h.anchor) ?? ''}
                    onSelect={(h) => goToTocEntry(anchorLoc(h.anchor))}
                  />
                )
              },
              { id: 'search', label: 'Search', content: <SearchPanel search={search} focusToken={searchFocus} /> }
            ]}
          />
        )}
        <main className="reader-pane" ref={paneRef} tabIndex={-1}>
          {phase.kind === 'opening' && <p className="reader-status">Opening…</p>}
        </main>
        {phase.kind === 'ready' && <OcrNotice ocr={ocr} />}
      </div>

      {/* Always rendered for EPUB so the pane never changes size after the book is laid out. */}
      {book.format === 'epub' && <footer className="status-bar">{progress?.label ?? ' '}</footer>}

      {popup && phase.kind === 'ready' && (
        <HighlightPopup popup={popup} highlights={hl} adapterRef={adapterRef} onOpen={setPopup} onClose={() => setPopup(null)} />
      )}

      {phase.kind === 'password' && (
        <Dialog title="Password required" confirmLabel="Open" onConfirm={() => void tryOpen(password)} onCancel={onClose}>
          <p>This PDF is protected. Enter its password to open it.</p>
          <input
            type="password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
          {phase.wrong && <p className="error">Incorrect password. Try again.</p>}
        </Dialog>
      )}
    </div>
  )
}

/** Ctrl+0: fit page for PDF, default text size (keeping the font) for EPUB. */
function defaultView(view: ViewState | null): ViewSettings {
  if (view?.kind === 'epub') return { epub: { fontSize: FONT_SIZE.default, fontFamily: view.fontFamily } }
  return { pdf: { zoom: 'fit-page' } }
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.(pdf|epub)$/i, '')
}
