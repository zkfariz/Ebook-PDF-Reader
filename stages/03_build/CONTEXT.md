# Stage 03 · Build

**Job:** Implement one build slice at a time in `/app`, keeping the app runnable after every slice.

Note: unlike the other stages, the code lives in `../../app/`, not in `output/`. `output/` holds only the build log.

## Inputs

| File | Layer | Why |
|---|---|---|
| `../02_architecture/output/build-plan.md` | 4 | Which slice is next |
| `../02_architecture/output/architecture.md` | 4 | Interfaces and boundaries |
| `../02_architecture/output/data-model.md` | 4 | Stored data shapes |
| `../01_spec/output/spec.md` | 4 | Acceptance criteria for the slice's features |
| `../../_config/design-system.md` | 3 | Tokens, layout, themes |
| `../../_config/coding-conventions.md` | 3 | Code style and folder rules |
| `../../skills/*.md` | 3 | Only the skill that matches the slice |
| `../04_test-review/output/bug-list.md` | 4 | Only when fixing bugs |

## Process

1. Pick the next slice that is not done in `build-plan.md`. Build only that slice.
2. Write or update the code in `app/`. Keep the PDF- and EPUB-specific code behind the Reader adapter.
3. Add unit tests for the logic that does not need a UI (data store, location parsing, search result mapping).
4. Run `npm run dev` and try the slice by hand with books from `shared/test-books.md`.
5. Add an entry to `output/build-log.md`: the slice, what changed, how it was checked, and known gaps.
6. Update `shared/feature-register.md` (⬜ → 🔨 or 🔍).
7. **Review gate:** the human tries the slice before the next one starts.

## Outputs

| File | Location | Format |
|---|---|---|
| Source code | `../../app/` | Electron + Vite + TypeScript project |
| `build-log.md` | `output/` | One dated entry per slice |

## Audit

- [ ] `npm run dev` starts without errors; `npm run typecheck` and `npm test` pass.
- [ ] No animations or transitions were added to page changes.
- [ ] Both themes look right (check with night mode on).
- [ ] The app does not write to the opened book file.
- [ ] The slice's acceptance criteria from the spec pass by hand.
