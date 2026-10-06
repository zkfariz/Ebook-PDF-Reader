# Stage 02 · Architecture

**Job:** Confirm the tech stack, design the data model and module layout, and plan the build order as small vertical slices.

## Inputs

| File | Layer | Why |
|---|---|---|
| `../01_spec/output/spec.md` | 4 | What must be built |
| `../../_config/tech-stack.md` | 3 | Proposed stack (confirm or change it) |
| `../../_config/coding-conventions.md` | 3 | Structure and style rules |
| `../../skills/pdf-rendering.md` | 3 | PDF.js approach and pitfalls |
| `../../skills/epub-rendering.md` | 3 | EPUB engine approach and pitfalls |
| `../../shared/decisions-log.md` | 3 | Earlier decisions |

## Process

1. Confirm each item in `tech-stack.md`. Check that the library versions are current. Log every change in `decisions-log.md`.
2. Define one **Reader adapter interface** that both the PDF and EPUB engines implement (open, render, goTo, next/prev, getToc, search, getSelection, addHighlight, location ↔ string). The UI talks only to this interface.
3. Design the stored data: library entries, reading position, bookmarks, highlights and notes. Show the JSON shape, explain how a book is identified (hash of the file, not its path), and show the location format per engine (PDF: page plus text offsets; EPUB: CFI).
4. Draw the process boundary: what runs in Electron main (file dialogs, file reads, data store) and what runs in the renderer (UI, engines), and list the IPC calls through `preload`.
5. Write the build order as slices, each one runnable: e.g. S1 open+render PDF → S2 navigation/zoom → S3 EPUB adapter → S4 library+resume → …
6. **Review gate:** the human approves before Stage 03.

## Outputs

| File | Location | Format |
|---|---|---|
| `architecture.md` | `output/` | Stack table, module diagram, adapter interface, IPC list |
| `data-model.md` | `output/` | JSON schemas with examples |
| `build-plan.md` | `output/` | Ordered slices; each lists feature IDs, files touched, and "done when" |

## Audit

- [ ] Every spec feature maps to at least one build slice.
- [ ] The renderer has no direct Node/file system access (`contextIsolation` on, `nodeIntegration` off).
- [ ] Highlights survive a zoom change, a window resize and an app restart (the location format does not depend on pixels).
- [ ] Book identity survives the file being moved or renamed.
