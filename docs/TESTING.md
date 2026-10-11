# How we test

Every change goes through the same loop: build, test, deploy, check the live site, fix, improve, test again. A change is done when the live page behaves the way the pull request says it does.

## Automatic checks (run on every pull request)
| Check | What it catches | Run it yourself |
|---|---|---|
| `tools/validate.py` | A program file with a missing field, a bad date, a dash character, or a contradiction (for example a deadline with no confirmation) | `python3 tools/validate.py` |
| Python tests | The data tools, plus the docs and workflow files | `python3 -m unittest discover -s tests -v` |
| `tests/lib.test.mjs` | The filter, date and plan logic, with no browser | `node --test tests/*.test.mjs` |
| Speed numbers | How long search, sort, place counts and loading the data take. Run it before and after a change to compare; CI fails only if a median goes over a loose ceiling (`tests/r1-perf-scale-8.test.mjs`) | `node tools/bench-matches.mjs` |
| `tests/*.dom.test.mjs` | Real pages loaded in jsdom with their real scripts: click, type, and check what appears | `npm ci` once, then `node --test tests/*.test.mjs` |
| Rebuild and diff | Someone edited a generated page by hand or forgot to rebuild | `python3 tools/build_data.py && python3 tools/build.py && git status` |
| `tools/hygiene.py` | Soft data problems that need a person's eye: open cards whose page printed no year, rolling or open cards that say full or closed, odd age limits, and home-page links when a deeper page was read. Read only, prints a checklist, never fails CI | `python3 tools/hygiene.py` |
| `tests/r2-a11y-perf-11.test.mjs` | The Home picker loads the small `data/entries-blurb.json` (id, what_you_do, deadline_text) for its four cards and never the 1.5 MB lite file | `node --test tests/r2-a11y-perf-11.test.mjs` |
| Dash scan | An em dash or en dash anywhere in the text | see `ci.yml` |

## Scheduled checks
Weekly link check, monthly "needs a re-check" issue, CodeQL.

## Checks a person does
jsdom does not draw anything, so layout and printing need eyes. Before a change to a page is called done, open the live page at a phone width (390 pixels) and a desktop width, look for text that overflows, and try the main action once. The pre-promotion checklist is in `ROADMAP.md`.

## Where the tests live
All test files are in `tests/`.
- `tests/test_*.py` are Python `unittest` tests. Most test the tools in `tools/`. `test_docs_sync.py` and `test_workflows.py` test the docs and the workflow files.
- `tests/*.test.mjs` are Node tests that use `node:test`. `tests/lib.test.mjs` tests `assets/js/lib.js` with no browser.
- Files ending in `.dom.test.mjs` load a built page in jsdom, with its real scripts, through `tests/dom-helper.mjs`.
- Files with `r1-`, `r2-` or `r3-` in the name were added in review rounds. The area comes right after the round prefix, and a number ends the name, optionally followed by a short label such as `-ics-fold`. The `.mjs` areas are `a11y-perf`, `accuracy`, `data-content`, `docs-ops`, `perf-scale`, `ranking-ux`, `teen-flow` and `tests`. The Python files use underscores, for example `test_r1_data_hygiene_2.py`.

To run one file:

```bash
node --test tests/lib.test.mjs
python3 -m unittest tests.test_tools -v
```

The Home picker budget: after a pick, `tests/r3-a11y-perf-2-home-four-files.test.mjs` checks the four cards come from `data/programs/<id>.json` (under 20000 bytes in all), never from the big shared files. `data/programs` is published with the site and is not in `.gitignore`.

The Numbers page budget: `tests/r3-a11y-perf-6-insights-stats-file.test.mjs` checks `insights.html` reads `data/entries-stats.json` (same ids and order as the entries file, only the keys `lib.insights()` reads, null values left out) and never the card file, and that every number on the page matches `L.insights` run on the full data. `tests/test_r3_tools.py` checks the file is a projection of `entries.json` and under 60 percent of the card file.

## Writing a page test
`tests/dom-helper.mjs` starts a tiny local server and gives you `loadPage("playbook.html")`, `type()` and `tick()`. Start from `tests/playbook.dom.test.mjs`.
