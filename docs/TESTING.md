# How we test

Every change goes through the same loop: build, test, deploy, check the live site, fix, improve, test again. A change is done when the live page behaves the way the pull request says it does.

## Automatic checks (run on every pull request)
| Check | What it catches | Run it yourself |
|---|---|---|
| `tools/validate.py` | A program file with a missing field, a bad date, a dash character, or a contradiction (for example a deadline with no confirmation) | `python3 tools/validate.py` |
| Python tests | The data tools, plus the docs and workflow files | `python3 -m unittest discover -s tests -v` |
| `tests/lib.test.mjs` | The filter, date and plan logic, with no browser | `node --test tests/*.test.mjs` |
| `tests/r3-a11y-perf-14-find-gaps-lazy.test.mjs` | Find page: `data/gaps.json` is not requested until a place or hub is chosen, is requested once by the versioned URL, and a failed request leaves the cards up with no console error |
| `tests/r1-a11y-perf-2-versioned-data.test.mjs` | A data file requested without the build version (`?v=`), or with cache no-cache, on Home, Programs, Calendar or Ages 12 to 14 | `node --test tests/r1-a11y-perf-2-versioned-data.test.mjs` |
| Speed numbers | How long search, sort, place counts and loading the data take. Run it before and after a change to compare; CI fails only if a median goes over a loose ceiling (`tests/r1-perf-scale-8.test.mjs`) | `node tools/bench-matches.mjs` |
| `tests/*.dom.test.mjs` | Real pages loaded in jsdom with their real scripts: click, type, and check what appears | `npm ci` once, then `node --test tests/*.test.mjs` |
| Rebuild and diff | Someone edited a generated page by hand or forgot to rebuild | `python3 tools/build_data.py && python3 tools/build.py && git status` |
| `tools/hygiene.py` | Soft data problems that need a person's eye: open cards whose page printed no year, rolling or open cards that say full or closed, odd age limits, and home-page links when a deeper page was read. Read only, prints a checklist, never fails CI | `python3 tools/hygiene.py` |
| `tests/r2-a11y-perf-11.test.mjs` | The Home picker loads the small `data/entries-blurb.json` (id, what_you_do, deadline_text) for its four cards and never the 1.5 MB lite file | `node --test tests/r2-a11y-perf-11.test.mjs` |
| `tests/r3-a11y-perf-9-interview-independent-load.test.mjs` | The Resume interview tips load from `interview.json` alone: if `permits.json` fails or is slow, the tips still show and the hours checker says the state rules could not load | `node --test tests/r3-a11y-perf-9-interview-independent-load.test.mjs` |
| `tests/r3-handout-1.test.mjs` | The `handout` page for teachers and counselors: title, address text, static home QR, three steps, what the guide is not, last checked date, print button, breadcrumb, footer link and print CSS | `node --test tests/r3-handout-1.test.mjs` |
| `tests/r3-a11y-perf-15-first-load-data-inventory.test.mjs` | Every page's first-load `data/` requests match an in-file table (page, paths, byte ceiling, reason). A new fetch, a dropped fetch, or a page over its ceiling fails until the table is reviewed | `node --test tests/r3-a11y-perf-15-first-load-data-inventory.test.mjs` |
| `tests/a11y-zero-chip-contrast.test.mjs` | The count text in filter chips and tiles (`.chip .n`, `.tile .n`) is at least 4.5:1 against its background in every state (zero, pressed, hover), in light and dark mode. An opacity on the count is blended with the background, so the token-pair check in `contrast.test.mjs` cannot see it | `node --test tests/a11y-zero-chip-contrast.test.mjs` |
| `tests/a11y-state-contrast.test.mjs` | A table of interactive states in `style.css` (`.chip`, `.tile`, `.btn`, `.star`, `.nav a`, `.foot a`, `.callout a`; default, `:hover`, `[aria-pressed="true"]`) is resolved to real colors for light and dark mode. Text must be at least 4.5:1 and 2px or wider borders at least 3:1 against the page background. A state in the table with no matching CSS rule fails by name, and a failing assertion names the selector so a CSS fix can be filed | `node --test tests/a11y-state-contrast.test.mjs` |
| `tests/r4-a11y-perf-1-focus-ring-surfaces.test.mjs` | The keyboard focus ring is at least 3:1 on each surface a control can sit on (page paper, cards, the yellow callout and the dark footer), in light and dark mode. The yellow callout and the footer have their own ring color, and those rules must not be inside print. `--tag-bg` is not checked, because a control's ring is drawn on the page around it, not on its fill | `node --test tests/r4-a11y-perf-1-focus-ring-surfaces.test.mjs` |
| `tests/r4-a11y-perf-2-print-source-line.test.mjs` | Every built root page (all but 404) has one `p.printonly.print-source` under body, outside main, aria-hidden, with its own canonical URL and the footer "Last checked" date, so a printed sheet says where its numbers came from. `style.css` hides `.print-source` on screen, shows it in `@media print`, and `body.print-one` still hides it | `node --test tests/r4-a11y-perf-2-print-source-line.test.mjs` |
| `tests/r4-a11y-perf-4-lib-only-when-used.test.mjs` | `assets/js/lib.js` (44 KB) loads on a built page only when its own script uses a lib name (G.esc, G.lib, G.fillPlaces and the like) or a common.js feature that needs it (`.share-parent[data-share]`, a tap-tile picker). Share and Leaders say `lib: none` in their source header and load neither lib.js nor anything else from lib. Their Copy and Print buttons still work in jsdom | `node --test tests/r4-a11y-perf-4-lib-only-when-used.test.mjs` |
| `tests/a11y-no-inline-h1-size.test.mjs` | Every built root page's h1 has no inline `style` that sets `font-size`, and `assets/css/style.css` has an `h1.display` rule with `font-size: clamp(2.2rem, 7vw, 4rem)`. The hero size lives in one place. Run with `node --test tests/a11y-no-inline-h1-size.test.mjs` |
| `tests/a11y-prefers-contrast.test.mjs` | The `@media (prefers-contrast: more)` block in `style.css` sits outside print, sets `--ink-2` to the same color as `--ink` in light and dark mode, turns off the `body::before` speckle overlay, and keeps every overridden text color at least 4.5:1 on `--paper` and `--surface`. Deleting the block fails the check. Run with `node --test tests/a11y-prefers-contrast.test.mjs` |
| `tests/a11y-print-buttons.test.mjs` | Every button inside `main` on every built root page (and the buttons that find.html and playbook.html build in JS) is hidden by an `@media print` `display: none` rule, or is the chosen `.tile[aria-pressed=true]`, which prints on purpose. Paper cannot be clicked, so a dead button box in a handout fails | `node --test tests/a11y-print-buttons.test.mjs` |
| `tests/a11y-table-names.dom.test.mjs` | Every `<table>` in `main` on every built root page (after data loads, and the paycheck estimate after a calculation) has a caption, aria-label or aria-labelledby that gives a non-empty name, and no two tables on one page share a name. Tables in `#printRoot` are ignored | `node --test tests/a11y-table-names.dom.test.mjs` |
| `tests/a11y-autocomplete-tokens.test.mjs` | The teen's own fields on the permit, interview, playbook and resume pages carry the matching autocomplete token (given-name, name, email, tel, address-level2). Every other text field is listed as staying on `off`, so a new field with the wrong token fails until it is listed on purpose (WCAG 1.3.5) | `node --test tests/a11y-autocomplete-tokens.test.mjs` |
| `tests/a11y-rendered-names.dom.test.mjs` | After scripts draw cards, tables and forms, every built root page has no duplicate id, every `aria-labelledby`, `aria-describedby` and `aria-controls` target exists, every input, select and textarea has a label, every button and link has a name, and every nav has its own label. It repeats after one interaction on resume (fill the empty entry), playbook (add a person), permit (choose a state), paycheck (a calculation) and find (Show more) | `node --test tests/a11y-rendered-names.dom.test.mjs` |
| `tests/test_data_text_agreement.py` | A card's age fields, status and dates must agree with its own text: open-now or opens-soon with a null `deadline_iso` and a future "due <Month> <day>, <year>", ages outside "ages N to M" in `who_can_apply`, or a closed card saying the page is open. Known cards sit in an allow-list with a reason | `python3 -m unittest tests.test_data_text_agreement -v` |
| `tests/test_data_text_agreement.py` (entries.json checks) | Over every card in `data/entries.json`: open-now or rolling whose `deadline_text` says the page does not say whether it is open, or says all roles are closed or full; opens-soon with a null or past `opens_iso`; `paid_type` mixed whose `pay_detail` only says not stated. Unfixed cards sit in a named allow-list with a reason | `python3 -m unittest tests.test_data_text_agreement -v` |
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
- Files with `r1-`, `r2-` or `r3-` in the name were added in review rounds. The area comes right after the round prefix, and a number ends the name, optionally followed by a short label such as `-ics-fold`. The `.mjs` areas are `a11y-perf`, `accuracy`, `data-content`, `docs-ops`, `handout`, `oc`, `perf-scale`, `ranking-ux`, `teen-flow` and `tests`. The Python files use underscores, for example `test_r1_data_hygiene_2.py`.

To run one file:

```bash
node --test tests/lib.test.mjs
python3 -m unittest tests.test_tools -v
```

The Home picker budget: after a pick, `tests/r3-a11y-perf-2-home-four-files.test.mjs` checks the four cards come from `data/programs/<id>.json` (under 20000 bytes in all), never from the big shared files. `data/programs` is published with the site and is not in `.gitignore`.

The Numbers page budget: `tests/r3-a11y-perf-6-insights-stats-file.test.mjs` checks `insights.html` reads `data/entries-stats.json` (same ids and order as the entries file, only the keys `lib.insights()` reads, null values left out) and never the card file, and that every number on the page matches `L.insights` run on the full data. `tests/test_r3_tools.py` checks the file is a projection of `entries.json` and under 60 percent of the card file.

## Writing a page test
`tests/dom-helper.mjs` starts a tiny local server and gives you `loadPage("playbook.html")`, `type()` and `tick()`. Start from `tests/playbook.dom.test.mjs`.
