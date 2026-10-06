# Where do I go?

| Task | Go to | Notes |
|---|---|---|
| **Start the project** from scratch | `stages/01_spec/` → 02 → 03 → 04 → 05 | Run the stages in order. Stop at each review gate. |
| **Add a new feature** | `stages/01_spec/` (add it to the spec) → 03 → 04 | Add it to `shared/feature-register.md` first. Go through 02 only if it touches the data model or stack. |
| **Fix a bug** | `stages/03_build/` → 04 | Log it in `stages/04_test-review/output/bug-list.md` first if it is not already there. |
| **Build a new installer / release** | `stages/05_package-release/` | Bump the version, then write release notes. |
| Change **colours, fonts or layout** | `_config/design-system.md` | Then go to Stage 03 to apply the change. |
| Change a **library or framework** | `stages/02_architecture/` | Log it in `shared/decisions-log.md`. |
| Check **which features are done** | `shared/feature-register.md` | |
| Find **how to render PDF / EPUB** or **package for Windows** | `skills/` | |

**Stage flow:** `01_spec/output` feeds 02 → `02_architecture/output` feeds 03 → `app/` feeds 04 → `04_test-review/output` (sign-off) feeds 05. Each stage reads only what its Inputs table lists.
