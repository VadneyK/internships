# 0007. Byte budgets and ratchets are tests

Status: Accepted (2026-10-13)

## Context
Many teens use a phone on a slow connection. Data grows with every program added. `docs/TESTING.md` lists the size tests: first-load ceilings, a per-file size ratchet and a first-load data inventory.

## Decision
- Size limits are tests, not advice: `tests/r1-perf-scale-1.test.mjs` (first-load weight ceilings), `tests/r3-tests-4-size-ratchet.test.mjs` (a byte ceiling per file) and `tests/r3-a11y-perf-15-first-load-data-inventory.test.mjs` (every first-load data request is listed).
- A file with no row fails, so a new file is added on purpose. A file over its ceiling fails until its row is raised on purpose, with a reason.
- A first-load ceiling goes up only when a person approves the extra weight for phone users. The approval is written in the pull request and in the comment above the limit (`docs/TESTING.md`, "First-load weight ceilings").
- Adding cards is not a reason by itself to raise a limit. Slim the entries first.

## Consequences
- Weight can only grow in a visible, reviewed step.
- A data wave can turn CI red on size. `docs/RUNBOOK.md` says how to respond.
- Ceilings need upkeep and a dated note each time one is raised.
