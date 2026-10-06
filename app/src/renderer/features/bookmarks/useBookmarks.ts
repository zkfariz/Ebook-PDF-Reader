import { useCallback, useMemo, useState, type RefObject } from 'react'
import type { BookFormat } from '@shared/ipc'
import type { Bookmark } from '@shared/schemas'
import type { Progress, ReaderAdapter, TocItem } from '../../reader/ReaderAdapter'
import type { BookSession } from '../reader/BookSession'

/**
 * Bookmarks of the open book (F06): the sorted list, whether the current screen is bookmarked,
 * and toggle/delete. Saved through BookSession.
 */
export function useBookmarks(
  format: BookFormat,
  adapterRef: RefObject<ReaderAdapter | null>,
  sessionRef: RefObject<BookSession | null>,
  progress: Progress | null,
  toc: TocItem[] | null
) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])

  /** Call once the book's saved data has loaded. */
  const load = useCallback(() => setBookmarks(sessionRef.current?.bookmarks ?? []), [sessionRef])

  // Recomputed on every page change (progress) so the toolbar button stays in sync.
  const onThisScreen = useMemo(() => {
    const adapter = adapterRef.current
    return adapter && progress ? bookmarks.filter((b) => adapter.containsLoc(b.loc)) : []
  }, [bookmarks, progress, adapterRef])

  const sorted = useMemo(() => {
    const adapter = adapterRef.current
    return adapter ? [...bookmarks].sort((a, b) => adapter.compareLocs(a.loc, b.loc)) : bookmarks
  }, [bookmarks, adapterRef])

  /** Ctrl+B / 🔖: removes the bookmark(s) on this screen, or adds one (F06.1). */
  const toggle = useCallback(() => {
    const session = sessionRef.current
    const adapter = adapterRef.current
    if (!session || !adapter || !progress) return
    if (onThisScreen.length > 0) {
      setBookmarks(session.removeBookmarks(onThisScreen.map((b) => b.id)))
      return
    }
    const loc = adapter.bookmarkLoc()
    if (loc) setBookmarks(session.addBookmark(loc, bookmarkLabel(format, progress, toc)))
  }, [adapterRef, sessionRef, progress, toc, format, onThisScreen])

  const remove = useCallback(
    (id: string) => {
      const session = sessionRef.current
      if (session) setBookmarks(session.removeBookmarks([id]))
    },
    [sessionRef]
  )

  return { bookmarks: sorted, isBookmarked: onThisScreen.length > 0, toggle, remove, load }
}

/** "Chapter 3 · p. 12" (PDF) or "Chapter 3 · 37%" (EPUB); just the position if there is no chapter. */
export function bookmarkLabel(format: BookFormat, progress: Progress, toc: TocItem[] | null): string {
  const where = format === 'pdf' ? `p. ${progress.current}` : `${Math.round(progress.fraction * 100)}%`
  const chapter = progress.tocId && toc ? findLabel(toc, progress.tocId) : undefined
  return chapter ? `${chapter.slice(0, 200)} · ${where}` : where
}

function findLabel(items: TocItem[], id: string): string | undefined {
  for (const item of items) {
    if (item.id === id) return item.label
    const inChild = findLabel(item.children, id)
    if (inChild) return inChild
  }
  return undefined
}
