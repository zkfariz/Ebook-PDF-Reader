import type { Bookmark } from '@shared/schemas'
import type { Loc } from '../../reader/ReaderAdapter'
import { formatLastOpened } from '../../ui/formatDate'
import './bookmarks.css'

interface BookmarkListProps {
  /** Already sorted in book order. */
  bookmarks: Bookmark[]
  onSelect: (loc: Loc) => void
  onDelete: (id: string) => void
}

/** F06: bookmarks of this book, in book order; click to jump, 🗑 to delete. */
export function BookmarkList({ bookmarks, onSelect, onDelete }: BookmarkListProps) {
  if (bookmarks.length === 0) return <p className="sidebar-empty">No bookmarks yet. Press Ctrl+B to add one.</p>
  return (
    <ul className="bookmarks" aria-label="Bookmarks">
      {bookmarks.map((b) => (
        <li key={b.id}>
          <button className="bookmark-link" onClick={() => onSelect(b.loc)}>
            <span className="bookmark-label">{b.label}</span>
            <span className="bookmark-date">{formatLastOpened(b.createdAt)}</span>
          </button>
          <button className="bookmark-delete" aria-label={`Delete bookmark ${b.label}`} onClick={() => onDelete(b.id)}>
            🗑
          </button>
        </li>
      ))}
    </ul>
  )
}
