import { useEffect, useRef, useState } from 'react'
import type { Loc, TocItem } from '../../reader/ReaderAdapter'
import './toc.css'

interface TocTreeProps {
  items: TocItem[] | null // null = still loading
  currentId?: string
  onSelect: (target: Loc) => void
}

/** F10: the book's contents as a collapsible tree; the current chapter is highlighted. */
export function TocTree({ items, currentId, onSelect }: TocTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const listRef = useRef<HTMLUListElement>(null)

  // Keep the current chapter in view as the reader pages through the book (F10.4).
  useEffect(() => {
    listRef.current?.querySelector('[aria-current="location"]')?.scrollIntoView({ block: 'nearest' })
  }, [currentId])

  if (items === null) return null
  if (items.length === 0) return <p className="sidebar-empty">This book has no table of contents.</p>

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const render = (list: TocItem[], depth: number) =>
    list.map((item) => {
      const hasChildren = item.children.length > 0
      const open = !collapsed.has(item.id)
      return (
        <li key={item.id} role="treeitem" aria-expanded={hasChildren ? open : undefined}>
          <div className="toc-row" style={{ paddingLeft: depth * 14 }}>
            {hasChildren ? (
              <button
                className="toc-twisty"
                aria-label={`${open ? 'Collapse' : 'Expand'} ${item.label}`}
                onClick={() => toggle(item.id)}
              >
                {open ? '▾' : '▸'}
              </button>
            ) : (
              <span className="toc-twisty" aria-hidden="true" />
            )}
            <button
              className="toc-link"
              disabled={!item.target}
              aria-current={item.id === currentId ? 'location' : undefined}
              onClick={() => item.target && onSelect(item.target)}
            >
              {item.label}
            </button>
          </div>
          {hasChildren && open && <ul role="group">{render(item.children, depth + 1)}</ul>}
        </li>
      )
    })

  return (
    <ul className="toc" role="tree" aria-label="Table of contents" ref={listRef}>
      {render(items, 0)}
    </ul>
  )
}
