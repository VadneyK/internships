# 0006. Tap tiles instead of dropdowns for short lists

Status: Accepted (2026-10-13)

## Context
A review in October 2026 looked at how a 12 to 18 year old uses the site on a phone. `docs/ROADMAP.md`, "Youth-first design rules (added 2026-10-10)", records the result.

## Decision
- Short lists are big tap tiles (`TIG.tilePicker`, or `data-tiles` on a `<select>`).
- The real `<select>` stays in the page, hidden, so links, saved choices and tests still work.
- Lists longer than 30 stay a dropdown.
- The Where picker is two taps: a part of the country, then a city (`PICK_GROUPS` in `assets/js/lib.js`).
- An answer panel never keeps content for a place the teen did not choose.
- Tap targets are at least 44px, and the nav folds behind one Menu button under 40rem.

## Consequences
- Choosing is faster on a phone, and the choices are visible.
- Each picker needs a hidden select kept in sync, and tile focus and contrast need tests (see `docs/TESTING.md`).
- Lists past 30 items need a different pattern, so a new long list is a design question, not a copy of the tiles.
- A type-to-search place box is not covered by the current docs. Add a record when its rules are written down.
