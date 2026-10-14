# 0001. Record decisions

Status: Accepted (2026-10-13)

## Context
Some choices in this project look odd to a new contributor: no framework, no accounts, tests that check file sizes. The reasons live in scattered places (`README.md`, `CONTRIBUTING.md`, `docs/ROADMAP.md`, `docs/TESTING.md`). A student who cannot find the reason may undo the choice.

## Decision
Keep a short record for each lasting decision in `docs/adr/`, named `NNNN-short-title.md`. Each record has four headings after the title: Status, Context, Decision and Consequences. Keep a record under 40 lines.

- Write a record only for a decision that is already made and visible in the repo, or for a new one a maintainer has approved.
- Say only what the repo docs already say. Link to the doc instead of copying it.
- Never edit an accepted record to change its meaning. Add a new record and mark the old one "Superseded by NNNN".
- Plain words, no em dashes or en dashes.

## Consequences
- A contributor can read why before changing a rule.
- Changing a decision takes a visible step: a new record in a pull request.
- The records are extra reading. Keeping each one short is the cost control.

Records so far:
- 0002: No accounts, no tracking, no third-party requests
- 0003: A plain static site, with generated files committed
- 0004: node:test with jsdom, not a test framework
- 0005: One JSON file per program, with schema, provenance and a fact-check
- 0006: Tap tiles instead of dropdowns for short lists
- 0007: Byte budgets and ratchets are tests
