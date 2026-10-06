/** "Today 09:12" · "Yesterday 18:40" · "3 Sep 2026" (spec: Library screen). */
export function formatLastOpened(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dayMs = 24 * 60 * 60 * 1000
  if (d.getTime() >= startOfToday) return `Today ${time}`
  if (d.getTime() >= startOfToday - dayMs) return `Yesterday ${time}`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
