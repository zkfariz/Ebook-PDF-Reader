# Stage 01 · Spec

**Job:** Turn the v1 feature list into a short, testable spec, with acceptance criteria for each feature. This stage writes no code.

## Inputs

| File | Layer | Why |
|---|---|---|
| `../../shared/feature-register.md` | 3 | The agreed v1 feature list and IDs |
| `../../_config/design-system.md` | 3 | UI constraints (single page, no animation, day/night) |
| `references/reader-ux-notes.md` | 3 | Common behaviour of other ebook readers, to stay familiar |
| `output/spec.md` | 4 | Only when revising |

## Process

1. For each feature ID (F01…), write: what the user does, what they see, edge cases, and 2–5 acceptance criteria written as "Given / When / Then".
2. List the keyboard shortcuts in one table. Use common reader conventions (←/→, PgUp/PgDn, Ctrl+F, Ctrl+B, Ctrl+O, F11).
3. Sketch the screen layout in text: toolbar, sidebar tabs (Contents / Bookmarks / Highlights / Search), reading pane, library screen.
4. Mark anything unclear as an **Open question** at the bottom. Do not guess.
5. **Review gate:** the human approves `spec.md` before Stage 02.

## Outputs

| File | Location | Format |
|---|---|---|
| `spec.md` | `output/` | Markdown: features → acceptance criteria, shortcut table, layout sketch, open questions |

## Audit

- [ ] Every v1 feature in the register has a section and at least 2 acceptance criteria.
- [ ] Each feature says how it behaves for both PDF **and** EPUB, or says that it applies to only one format.
- [ ] No feature marked "later" in the register appears in the spec.
- [ ] The open questions are answered or explicitly deferred.
