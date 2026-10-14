# 0005. One JSON file per program, with schema, provenance and a fact-check

Status: Accepted (2026-10-13)

## Context
Wrong information hurts real kids (`docs/VERIFYING.md`). Many people propose programs, including students who do not code. Edits must be small, reviewable in public, and checkable by a robot.

## Decision
- Each program is one file, `data/programs/<id>.json`. It is the source of truth. The combined data files are generated and never edited by hand.
- Every file must pass `data/schema/program.schema.json`, checked by `python3 tools/validate.py` in CI.
- Provenance is part of the file: the official URL, `sources_fetched` (every page actually read), `verified` and `verified_on`.
- The rule is "No official page, no card." A news story, another site's list or a social post is a lead, not a source.
- A person follows the checklist in `docs/VERIFYING.md`. If the page cannot be read, the file is downgraded to `snippet-only` and the site shows a "Confirm first" tag.
- Bulk re-checks follow the method in `docs/MAINTAINING.md`, with one report per batch.

## Consequences
- A pull request that adds a program is one small file, easy to review.
- Every fact can be traced to a page and a date, so a reader can ask where it came from.
- Dates go stale. Bots open issues for broken links, old checks and passed deadlines (`docs/MAINTAINING.md`).
- The build must combine thousands of small files, so generated copies are committed (see 0003).
