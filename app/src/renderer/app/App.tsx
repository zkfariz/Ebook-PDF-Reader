import { useCallback, useEffect, useReducer, useState } from 'react'
import type { Theme } from '@shared/ipc'
import { LibraryScreen } from '../features/library/LibraryScreen'
import { ReaderScreen } from '../features/reader/ReaderScreen'
import { Dialog } from '../ui/Dialog'
import { matchShortcut } from './keymap'
import { openDropped, openPath, openWithDialog, type OpenedBook, type OpenResult } from './openBook'
import { applyTheme, type SidebarState, type Startup } from './theme'

interface State {
  screen: 'library' | 'reader'
  book: OpenedBook | null
  message: string | null // error dialog text
}

type Action =
  | { type: 'opened'; book: OpenedBook }
  | { type: 'close-book' }
  | { type: 'show-message'; message: string }
  | { type: 'dismiss-message' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'opened':
      // The book already on screen (e.g. opened again from File Explorer): keep reading where you are.
      if (state.screen === 'reader' && state.book?.bookId === action.book.bookId) return { ...state, message: null }
      return { ...state, screen: 'reader', book: action.book, message: null }
    case 'close-book':
      return { ...state, screen: 'library', book: null }
    case 'show-message':
      return { ...state, message: action.message }
    case 'dismiss-message':
      return { ...state, message: null }
  }
}

export function App({ startup }: { startup: Startup }) {
  const [state, dispatch] = useReducer(reducer, { screen: 'library', book: null, message: null })
  const [theme, setTheme] = useState<Theme>(startup.theme)
  const [sidebar, setSidebar] = useState<SidebarState>(startup.sidebar)

  // Sidebar open/closed and active tab are remembered (spec: Toggle sidebar).
  const changeSidebar = useCallback((next: SidebarState) => {
    setSidebar(next)
    void window.api.settings.set({ sidebar: next })
  }, [])

  const handle = useCallback((result: OpenResult) => {
    if (result.ok) dispatch({ type: 'opened', book: result.book })
    else if ('message' in result) dispatch({ type: 'show-message', message: result.message })
  }, [])

  const openBook = useCallback(() => void openWithDialog().then(handle), [handle])

  // Day / night (F08): global, remembered.
  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'day' ? 'night' : 'day'
      applyTheme(next)
      void window.api.settings.set({ theme: next })
      return next
    })
  }, [])

  // App-wide shortcuts: Ctrl+O and Ctrl+Shift+N. The reading shortcuts live in ReaderScreen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = matchShortcut(e)
      if (action === 'open') {
        e.preventDefault()
        openBook()
      } else if (action === 'toggle-theme') {
        e.preventDefault()
        toggleTheme()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openBook, toggleTheme])

  // Books opened from File Explorer (F15): at start-up and while the app is running.
  useEffect(() => {
    const take = () =>
      void window.api.files.takeOpenRequest().then((path) => {
        if (path) void openPath(path).then(handle)
      })
    take()
    return window.api.files.onOpenRequested(take)
  }, [handle])

  // Drag & drop a file anywhere on the window.
  useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault()
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer?.files[0]
      if (file) void openDropped(file).then(handle)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [handle])

  return (
    <>
      {state.screen === 'reader' && state.book ? (
        <ReaderScreen
          key={state.book.bookId} // another book starts a fresh reader
          book={state.book}
          theme={theme}
          onToggleTheme={toggleTheme}
          sidebar={sidebar}
          onSidebarChange={changeSidebar}
          onClose={() => dispatch({ type: 'close-book' })}
          onFatalError={(message) => {
            dispatch({ type: 'close-book' })
            dispatch({ type: 'show-message', message })
          }}
        />
      ) : (
        <LibraryScreen onOpenBook={openBook} onOpenResult={handle} theme={theme} onToggleTheme={toggleTheme} />
      )}

      {state.message && (
        <Dialog title="Can't open this file" onConfirm={() => dispatch({ type: 'dismiss-message' })}>
          <p>{state.message}</p>
        </Dialog>
      )}
    </>
  )
}
