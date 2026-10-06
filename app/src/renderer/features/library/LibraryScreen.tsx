import { useCallback, useEffect, useState } from 'react'
import type { LibraryListItem } from '@shared/ipc'
import { openPath, type OpenResult } from '../../app/openBook'
import type { Theme } from '@shared/ipc'
import { Dialog } from '../../ui/Dialog'
import { ThemeButton } from '../../ui/ThemeButton'
import { formatLastOpened } from '../../ui/formatDate'
import './library.css'

interface LibraryScreenProps {
  onOpenBook: () => void
  onOpenResult: (result: OpenResult) => void
  theme: Theme
  onToggleTheme: () => void
}

type Prompt =
  | { kind: 'remove'; entry: LibraryListItem }
  | { kind: 'missing'; entry: LibraryListItem }
  | { kind: 'different-file'; entry: LibraryListItem; path: string }
  | { kind: 'message'; text: string }

/** F04: simple list of every book opened, most recent first. */
export function LibraryScreen({ onOpenBook, onOpenResult, theme, onToggleTheme }: LibraryScreenProps) {
  const [books, setBooks] = useState<LibraryListItem[] | null>(null)
  const [prompt, setPrompt] = useState<Prompt | null>(null)

  const reload = useCallback(() => void window.api.library.list().then(setBooks), [])
  useEffect(reload, [reload])

  const open = async (entry: LibraryListItem) => {
    const result = await openPath(entry.path)
    if (!result.ok && 'code' in result && result.code === 'not-found') setPrompt({ kind: 'missing', entry })
    else onOpenResult(result)
  }

  const openAfterLocate = async (path: string) => {
    setPrompt(null)
    onOpenResult(await openPath(path))
  }

  const locate = async (entry: LibraryListItem) => {
    const res = await window.api.library.locate(entry.bookId)
    if (res.ok) return openAfterLocate(res.path)
    if (res.reason === 'different-file') return setPrompt({ kind: 'different-file', entry, path: res.path })
    if (res.reason === 'unsupported') return setPrompt({ kind: 'message', text: 'That file is not a PDF or EPUB book.' })
    setPrompt({ kind: 'missing', entry }) // cancelled: keep asking
  }

  const remove = async (entry: LibraryListItem) => {
    setPrompt(null)
    await window.api.library.remove(entry.bookId)
    reload()
  }

  return (
    <div className="library">
      <header className="toolbar">
        <span className="title">Ebook Reader</span>
        <button className="primary" onClick={onOpenBook} title="Open book (Ctrl+O)">
          Open book…
        </button>
        <ThemeButton theme={theme} onToggle={onToggleTheme} />
      </header>

      {books && books.length === 0 && (
        <main className="library-empty">
          <p>No books yet.</p>
          <p className="hint">Click Open book… or drag a PDF/EPUB here.</p>
        </main>
      )}

      {books && books.length > 0 && (
        <main className="library-list">
          <table>
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Author</th>
                <th scope="col">Type</th>
                <th scope="col">Last opened</th>
                <th scope="col" className="num">
                  Progress
                </th>
                <th scope="col">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.bookId} className={b.missing ? 'missing' : undefined}>
                  <td>
                    <button className="book-link" onClick={() => void open(b)} title={b.path}>
                      {b.missing && <span aria-hidden="true">⚠ </span>}
                      {b.title}
                      {b.missing && <span className="muted"> (file not found)</span>}
                    </button>
                  </td>
                  <td className="muted">{b.author ?? '—'}</td>
                  <td className="muted">{b.format.toUpperCase()}</td>
                  <td className="muted">{formatLastOpened(b.lastOpened)}</td>
                  <td className="num muted">{Math.round(b.progress * 100)}%</td>
                  <td>
                    <button
                      className="remove"
                      aria-label={`Remove ${b.title} from library`}
                      title="Remove from library"
                      onClick={() => setPrompt({ kind: 'remove', entry: b })}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
      )}

      {prompt?.kind === 'remove' && (
        <Dialog
          title="Remove from library?"
          confirmLabel="Remove"
          danger
          onConfirm={() => void remove(prompt.entry)}
          onCancel={() => setPrompt(null)}
        >
          <p>
            Remove <strong>{prompt.entry.title}</strong> from the library? Its bookmarks, highlights and notes will be
            deleted.
          </p>
          <p className="muted">The book file itself is not touched.</p>
        </Dialog>
      )}

      {prompt?.kind === 'missing' && (
        <Dialog
          title="File not found"
          confirmLabel="Locate file…"
          onConfirm={() => void locate(prompt.entry)}
          secondaryLabel="Remove from library"
          onSecondary={() => setPrompt({ kind: 'remove', entry: prompt.entry })}
          onCancel={() => setPrompt(null)}
        >
          <p>
            <strong>{prompt.entry.title}</strong> is no longer at:
          </p>
          <p className="muted path">{prompt.entry.path}</p>
          <p>If you moved it, locate the file to reconnect your bookmarks and highlights.</p>
        </Dialog>
      )}

      {prompt?.kind === 'different-file' && (
        <Dialog
          title="This looks like a different file"
          confirmLabel="Use it anyway"
          onConfirm={() =>
            void window.api.library.rekey(prompt.entry.bookId, prompt.path).then((r) => {
              if (r.ok) void openAfterLocate(prompt.path)
              else setPrompt({ kind: 'message', text: 'That file could not be read.' })
            })
          }
          onCancel={() => setPrompt(null)}
        >
          <p>The chosen file's content is not the same as the book you read before (it may be another edition).</p>
          <p>Use it anyway? Your bookmarks and highlights will be kept; any that no longer match will be marked.</p>
        </Dialog>
      )}

      {prompt?.kind === 'message' && (
        <Dialog title="Can't use this file" onConfirm={() => setPrompt(null)}>
          <p>{prompt.text}</p>
        </Dialog>
      )}
    </div>
  )
}
