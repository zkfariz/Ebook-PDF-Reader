# Design system · "Quiet page"

A calm, book-first interface: the page is the hero, and the controls stay small and out of the way.

## Rules

- **Single-page view only.** One page (PDF) or one screen of text (EPUB) at a time.
- **No animations.** No page-flip, slide or fade effects. Page changes are instant. (Small hover colour changes are fine.)
- **Two themes:** Day and Night, toggled from the toolbar (Ctrl+Shift+N) and remembered. The first launch follows the Windows theme.

## Colour tokens (day → night)

| Token | Day | Night | Use |
|---|---|---|---|
| `--bg` | #F4F1EA | #16171A | window background around the page |
| `--surface` | #FFFFFF | #1F2125 | toolbar, sidebar, popups |
| `--page` | #FFFFFF | #1B1C1F | EPUB page background |
| `--ink` | #1E1E1E | #DADADA | text |
| `--muted` | #6B6B6B | #8E9196 | secondary text, page numbers |
| `--line` | #DDD8CC | #2E3035 | borders, dividers |
| `--accent` | #2F6FDB | #6EA2FF | buttons, active tab, links |
| `--hl-yellow` | #FFE58A | #7A6420 | default highlight |
| `--hl-green` / `--hl-blue` / `--hl-pink` | #B9EBB0 / #B5D8FF / #F9C2D6 | #2F5A2A / #23466E / #6A2E44 | optional highlight colours |

**PDF in night mode:** apply `filter: invert(1) hue-rotate(180deg)` to the page canvas only, not to the highlight overlay.

## Type

- UI: `Segoe UI Variable`, falling back to `Segoe UI` and system-ui, at 14px.
- EPUB reading text: user-adjustable 14–28px (default 18px), line-height 1.6, max line length about 70 characters. Font choice: Serif (Georgia) / Sans (Segoe UI).

## Layout

```
┌ Toolbar: [☰] [Library] Title ......... [◀] 12 / 340 [▶]  [−] 100% [+]  [🔍] [🔖] [☀/☾] ┐
├ Sidebar (toggle, 280px) ┬ Reading pane (centred page, --bg around it)                  ┤
│ Tabs: Contents ·        │                                                              │
│ Bookmarks · Highlights ·│                                                              │
│ Search                  │                                                              │
└─────────────────────────┴──────────────────────────────────────────────────────────────┘
```

- **Library screen:** a simple list of titles (title, author, format, last opened, progress %), sorted by last opened. No cover grid in v1.
- **Selection popup:** appears above the selected text with colour dots, "Note" and "Copy".
