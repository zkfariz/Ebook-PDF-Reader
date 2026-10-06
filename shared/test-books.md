# Test books

Put sample files in `shared/test-books/`. Use free, public-domain sources such as Project Gutenberg (EPUB) and arXiv or government PDFs, and do not commit copyrighted books.

| File | Format | Why it's useful | Present? |
|---|---|---|---|
| a normal novel | EPUB | baseline: TOC, reflow, search | ✅ `Carnegie_-_How_To_Win_Friends_And_Influence_People.epub` |
| a book with no TOC | EPUB | "No contents" message | ✅ generated: `app/tests/fixtures/no-toc.epub` |
| a right-to-left or CJK book | EPUB | text direction, selection | ✅ RTL: generated Arabic EPUB (Stage 04, scratch only). CJK: ⬜ not tested |
| a text PDF with an outline (bookmarks) | PDF | TOC, search, highlights | ✅ generated: `app/tests/fixtures/toc.pdf` |
| a PDF without an outline | PDF | "No contents" message | ✅ `sample-3p.pdf`, Mims |
| a scanned PDF (images only) | PDF | search fails gracefully | ✅ `forrest-m-mims-iii-getting-started-in-electronics.pdf` (13 MB, 128 pp, hand-lettered scans) |
| a very large PDF (500+ pages, 50 MB+) | PDF | speed and memory | ✅ generated: `large-500p.pdf` (500 pages) + a 55 MB picture PDF (Stage 04, scratch only) |
| a password-protected PDF | PDF | password prompt or clear error | ✅ generated: `app/tests/fixtures/protected.pdf` (password `test`) |
