import type { ReactNode } from 'react'
import './sidebar.css'

export interface SidebarTab<Id extends string> {
  id: Id
  label: string
  content: ReactNode
}

interface SidebarProps<Id extends string> {
  tabs: SidebarTab<Id>[]
  active: Id
  onSelect: (id: Id) => void
}

/** Left sidebar with tabs (design system layout). Tabs are added as their features are built. */
export function Sidebar<Id extends string>({ tabs, active, onSelect }: SidebarProps<Id>) {
  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="sidebar-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={t.id === current?.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => onSelect(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {current && (
        <div className="sidebar-panel" role="tabpanel" id={`panel-${current.id}`} aria-labelledby={`tab-${current.id}`}>
          {current.content}
        </div>
      )}
    </aside>
  )
}
