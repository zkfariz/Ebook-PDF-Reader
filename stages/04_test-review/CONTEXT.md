# Stage 04 · Test & review

**Job:** Check the app against every acceptance criterion in the spec, record bugs, and sign off on a version for release.

## Inputs

| File | Layer | Why |
|---|---|---|
| `../01_spec/output/spec.md` | 4 | The acceptance criteria to check |
| `../../app/` | 4 | The build under test |
| `../../shared/test-books.md` | 3 | Which sample books to use |
| `../../shared/feature-register.md` | 3 | Which features claim to be done |
| `output/bug-list.md` | 4 | Existing bugs |

## Process

1. Run the automated checks: `npm run typecheck`, `npm test`.
2. For each feature, test every acceptance criterion with at least one PDF **and** one EPUB (where it applies). Include the awkward books from `test-books.md` (very large, scanned, no TOC, right-to-left).
3. Restart test: add a bookmark, a highlight and a note, close the app, reopen it, and confirm that everything is restored.
4. Record results in `output/test-report-vX.Y.Z.md` as pass/fail per criterion, with how each was tested (by hand or automated).
5. Add each failure to `output/bug-list.md` with an ID, steps, expected and actual results, and severity.
6. **Sign-off gate:** no open "blocker" bugs → mark the version ready in the test report and set the features to ✅ in the register.

## Outputs

| File | Location | Format |
|---|---|---|
| `test-report-vX.Y.Z.md` | `output/` | Criterion table: ID · result · method · notes |
| `bug-list.md` | `output/` | Running list: B001… · status · severity · steps |

## Audit

- [ ] Every criterion has a result; none are left blank.
- [ ] Untested items are listed as untested, not as passed.
- [ ] Each fixed bug was re-tested.
