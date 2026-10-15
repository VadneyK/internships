# 0004. node:test with jsdom, not a test framework

Status: Accepted (2026-10-13)

## Context
The browser code has no build step (see 0003), so it needs tests that load the real pages and real scripts. `docs/TESTING.md` describes the result: files ending in `.dom.test.mjs` load a built page in jsdom through `tests/dom-helper.mjs`. The data and build tools are tested with Python `unittest`.

## Decision
- JavaScript tests use the `node:test` runner that ships with Node, with jsdom as the page test dependency (`npm ci` installs it). Three more dev tools sit beside it: axe-core, for the accessibility sweep in `tests/a11y-axe.dom.test.mjs`; StrykerJS, for the weekly mutation test of `assets/js/lib.js` (`docs/TESTING.md`); and ESLint (added 2026-10-15), for the bug-class lint in `tests/lint.test.mjs` (config `tests/eslint.config.mjs`, no style rules). They are test tools and never reach the site.
- Run them with `node --test tests/*.test.mjs`. Python tests run with `python3 -m unittest discover -s tests -v`.
- No Jest, Vitest or browser-driver framework.
- Tests load built pages and real scripts, so they check what a visitor gets.
- `lib.js` logic is unit tested without the DOM.

## Consequences
- A few dev dependencies to install, and tests run on the Node version in `.nvmrc`.
- jsdom is not a real browser. It does not do layout, so layout needs a separate check by a person.
- New test files must follow the naming rule in `docs/TESTING.md` and name themselves in their header run line.
- The suite is large, so CI time is a cost we watch (see `docs/RUNBOOK.md` for timing failures).
