# Maintaining the guide

## Rhythm
| When | What | Who |
|---|---|---|
| Weekly (automatic, Mondays; Thursdays for the wider check) | Link check (`tools/linkcheck.py`). It waits 1 second between requests to the same host (`--host-delay`) and stops starting new requests after 40 minutes (`--budget-minutes`). A broken link opens or updates an issue labeled `link-check`. Links it did not reach in time are listed under "Not checked" and are not counted as broken. Links that block scripts are listed under "Blocked or slow": open those in a browser. The full report is the `link-report` file on the workflow run, because a long report is cut short in the issue. On Thursdays a separate job in the same workflow (`sources`, with its own 210 minute timeout) runs a wider check (`--fields url,apply_url,sources_fetched --aux`) with the same delay but a 170 minute budget (about 4,900 links against about 3,000 on Monday, so the 40 minute Monday budget would leave much of it under "Not checked"): it also visits the pages each program's facts were read from (`sources_fetched`) and every https link in the hand-edited data files (`--aux`: permits, states-lite, state-wages, employers, languages, safety, money, transit, younger, parents, interview, calendar). Extra broken links appear under "Broken sources" and "Broken aux links" in the same issue, and the issue title names which sections failed (program links, sources, aux links); fix a dead source by re-reading the fact it backs, not only by swapping the link. Run it by hand with the same flags. | Bot, then any contributor |
| Weekly (automatic, Wednesdays) | Lighthouse check (`.github/workflows/lighthouse.yml`, settings in `lighthouserc.json`). It audits six live pages (home, `find.html?at=city:boston`, calendar, permit, younger, jobs) on the mobile preset, 3 runs each. Accessibility must be 0.95 or higher, best practices and SEO 0.9 or higher (these fail the run); performance 0.8 is only a warning for now. A failure opens or updates one issue labeled `perf`; the reports are on the workflow run. Run it by hand from the Actions tab (`workflow_dispatch`). | Bot, then any contributor |
| Weekly (automatic, Sundays) | Mutation test of `assets/js/lib.js` (`.github/workflows/mutation.yml`, settings in `stryker.config.json`). Fails if the mutation score falls under `thresholds.break` (76). The HTML report is the `mutation-report` artifact on the run. A failure means a recent change to lib.js has logic no test checks: add a test, do not lower the threshold. See "Mutation testing of lib.js" in `docs/TESTING.md` | Maintainer |
| Monthly (automatic, 1st of the month) | Refresh list (`tools/freshness.py`). Opens an issue labeled `refresh` with a checklist of the 150 most urgent programs. The full list is the `refresh-full` file on the workflow run. | Bot, then hub captains |
| Daily (automatic) | Date check (`.github/workflows/dates.yml`). Runs `python3 tools/flip_dates.py` (a dry run) and the date agreement tests against today's date. If a program is due to flip, is held for a person, or a test fails, it opens or updates one issue labeled `dates`. The issue body ends with a hidden `report-sha256` comment; the bot adds a comment only when that hash differs from the last one on the issue, so an unchanged report stays quiet. Run `python3 tools/flip_dates.py --write` for the due cards and fix held cards by hand. | Bot, then any contributor |
| When Dependabot opens the monthly Actions pull request | Review the one grouped pull request. Actions are pinned to full commit SHAs with the version tag in a trailing comment (`# v7`); keep that form when editing a workflow, and look a new SHA up with `gh api repos/<owner>/<repo>/git/ref/tags/<tag>`. The npm entry groups all `@stryker-mutator/*` packages into one pull request, because `@stryker-mutator/tap-runner` pins an exact peer version of `@stryker-mutator/core` and separate pull requests would fail `npm ci`. | Any contributor |
| Weekly (automatic, Wednesdays) | CodeQL code scan. It also runs on every pull request and every push to `main`. Read any alert it raises. | Bot, then a maintainer |
| Each quarter | Hub captains re-read the official page of every program in their hub and update the files. This is a big job, so use the batch method in "Bulk fact-check pass" below. | Volunteers |
| Each August | New school year: roll deadlines forward, check every summer program for the next cycle | Everyone |
| Each January | Re-check the California minimum wage and work-permit pages on the Rules page | Maintainer |

## Regions and captains
Programs are grouped into hubs. A hub is an area teens recognize, and each hub covers several region ids. The list lives in `HUBS` in `assets/js/lib.js`. The program count is in `data/meta.json`.

| Hub id | Hub name |
|---|---|
| `davis` | Davis and Sacramento |
| `sv` | Silicon Valley |
| `oak` | Oakland and East Bay |
| `sf` | San Francisco |
| `state` | California-wide |
| `socal` | Southern California |
| `atl` | Atlanta and Georgia |
| `nyc` | New York |
| `chi` | Chicago and Illinois |
| `cv` | Merced and Central Valley |
| `sea` | Seattle and Washington |
| `van` | Vancouver, BC |
| `aus` | Austin and Texas |
| `midwest` | Midwest campuses |
| `east` | East Coast |
| `mtn` | Mountain West |
| `south` | South |
| `pac` | Oregon and Hawaii |
| `online` | Online and national |

A captain is anyone who agrees to own a hub: do its quarterly pass and answer issues for it. List captains in `CONTRIBUTORS.md`. To add a new region or hub, follow [Adding a region](ADDING_A_REGION.md).

## Bulk fact-check pass
A bulk pass re-reads the official page of many programs at once. The first one was on Oct 7, 2026: twelve checkers, with their reports in `docs/research/verification-2026-10-07/`. Use the same method again.

**When to run one**
- Before a new school year starts.
- After a rule change, for example a new minimum wage or work-permit rule.
- When the monthly refresh list is so long that one person cannot clear it.

**Steps**
1. **Make batches.** List every program id with its `regions` (see `data/entries.csv` or the files in `data/programs/`). Match each region to its hub using `HUBS` in `assets/js/lib.js`. A program can match two hubs, so put each id in only one batch. Make batches of about 100 ids by hub. Split a big hub into two or more batches, and join small hubs. Give each batch a number: 01, 02, and so on.
2. **Give each checker one batch.** The checker opens the official page for every program in the batch and follows the "Checklist" in `docs/VERIFYING.md`. The checker edits no other program.
3. **Write one report per batch.** Save it as `docs/research/verification-<date>/report-NN.md`, where `<date>` is the day the pass starts (for example `2026-10-07`) and `NN` is the batch number. Write one line per program id:
   - `<id>: OK` (the page still matches the file; add a short note if wording changed)
   - `<id>: FIXED (what changed)`
   - `<id>: DOWNGRADED to snippet-only (why)` (the official page could not be read; the site shows a "Confirm first" tag)
   - `<id>: REMOVED (why)` (for example the program ended, or it is for 18 and older only)

   If a checker cannot delete a file, the line says `NEEDS HUMAN DELETE (why)`. The October pass used this once. A maintainer deletes that file.
4. **A maintainer applies the reports.** Make the changes in `data/programs/<id>.json`, set `verified_on` to the day the page was read, and add each page to `sources_fetched`. Then run, in this order:
   - `pip install -r requirements-dev.txt` (once; the pinned Python tools)
   - `python3 tools/validate.py`
   - `python3 tools/build_data.py`
   - `python3 tools/build.py`
   - `node --test tests/*.test.mjs`
   - `python3 -m unittest discover -s tests`
5. **Commit the reports with the changes** and open one pull request, so the paper trail stays with the data. Add a line about the pass to `docs/research/README.md`.

**Rules for checkers**
- Every fact must come from the official page. A news story, a list on another site, or a social media post is a lead, not a source.
- A checker never invents an age, date or pay. If the page does not say it, write "not stated" or remove the claim.
- If the page cannot be read, downgrade the program. Do not guess from memory.

## Content-Security-Policy
Every page has a `Content-Security-Policy` meta tag, written in `src/_layout.html`. `tools/build.py` fills in `{{script_hashes}}` with a sha256 for each inline script in the built page, so editing the theme script in the layout updates the policy on the next build. Rebuild after any change to an inline script. Inline event handler attributes (`onclick`, `onsubmit` and the like) and `javascript:` links are blocked by the policy; use `addEventListener` in `assets/js`. Inline `style` attributes are allowed. A page may load only its own files (scripts, styles, fonts, data), plus `data:` images (no `blob:`); a new outside host needs a policy change on purpose. `frame-ancestors` and `report-uri` are ignored in a meta tag, so they are not set. `tests/r9-tests-1-csp-meta.test.mjs` pins the shape. After a change that adds a new kind of resource or download, open every page in a real browser (headless Chrome through the DevTools port) and check the console for "Refused to" messages.

The shared submit listener in `assets/js/common.js` calls `preventDefault` only on forms without an `action` attribute, so a form with a real `action` submits normally.

## security.txt

`.well-known/security.txt` expires inside one year of when it was written (now 2027-09-30T00:00:00Z). Renew it in September 2027 and keep `Expires` less than 366 days ahead of today (a test checks this); `tests/r3-tests-9-security-txt.test.mjs` fails once the date has passed. The source file is `.well-known/security.txt` in the repo root. The `deploy` job needs `include-hidden-files: true` to publish it, copies it into the site, fails if it is missing, and the smoke test asks the live site for it. `.nojekyll` must stay so Pages serves the dot folder. Limitation: this is a project Pages site, so the file is served at `https://vadneyk.github.io/internships/.well-known/security.txt`, not at the host root that RFC 9116 section 3 expects (there is no `vadneyk.github.io` user site repo). The `Canonical:` line declares the real location; keep it in sync if the site ever moves.

## Phone layout
Most teens use a phone, so the phone rules are easy to break. Three things to know.

**The phone nav relies on `html.js`.** The head script in `src/_layout.html` adds the class `js` to `<html>` before the page paints. Under 40rem, `style.css` has the rule `html.js .top:not(.open) .nav { display: none; }`, so the nav starts folded and the header does not jump when `common.js` adds the Menu button. Without it, the full nav shows first and then folds, which Lighthouse counts as a layout shift. If no script builds the menu, a failsafe in the same head script removes the `js` class after 3 seconds (when there is no `.top.menu-js`), and the links show. Do not remove either half. Keep the head script small: it is inline, so it is hashed into the Content-Security-Policy (see "Content-Security-Policy" above).

**Wide tables stack on a phone.** At 40rem and under, no table keeps the 34rem minimum width. A table with more than three columns would still be cut off, so give it `class="stackt"`. On a phone, `.stackt` turns each row into a block, hides the header row, and shows the column name above each cell. To use it:
- Put `class="stackt"` on the `<table>`.
- Start each cell (`td`) with `<span class="tk" aria-hidden="true">Column name</span>`. `.tk` is hidden on wide screens. The first cell of a row is a `<th scope="row">` and needs no label.
- Stacked rows are no longer laid out as a table, so write the table roles out: `role="table"` on the table, `role="rowgroup"` on `thead` and `tbody`, `role="row"` on each `tr`, and `role="columnheader"`, `role="rowheader"` and `role="cell"` on the cells.
- Keep the `tablewrap` around it (it is the keyboard-reachable scroll box).

Three tables use it now: the permit table on `parents.html` (`assets/js/parents.js`), "Hours by age" on `rules.html` (written in `src/rules.html`), and the state grid on `younger.html` (`assets/js/younger.js`). For a table that a script builds, copy how those scripts write the `.tk` span and the roles.

**Pickers ship with their tiles.** `tools/build.py` writes the tap tiles for the permit, jobs and calendar pickers into the page as `<div class="tp" data-pre aria-hidden="true">` (function `pre_tiles`). `G.tilePicker` in `assets/js/common.js` finds that block next to the `<select>`, keeps it, and fills it with the real tiles when the options arrive, so the picker holds its space and the page does not shift. `build.py` also writes a few other pieces the scripts used to add after load (the calendar note and month buttons, the jobs note, the default Your picks chips on `find.html`, the share buttons on `younger.html`). If you change the options a script adds, change the matching labels and order in `build.py`, then rebuild. The shipped tiles are inert until the options arrive, so if a data file fails to load, they stay inert. This is a known trade-off.

Phone changes add bytes. The ceilings raised for this work carry a "PENDING PERSON APPROVAL" note in the size tests (see `docs/TESTING.md`, "First-load weight ceilings"). Do not raise them again without an approval.

## Handling an issue
1. Read the official page yourself. Do not trust the report alone.
2. Fix the program file (`data/programs/<id>.json`), set `verified_on` to today, add the page to `sources_fetched`.
3. Run the build commands in `CONTRIBUTING.md`, commit, open a pull request that says `Fixes #<issue>`.

## Releasing
The site is served by GitHub Pages, and the Pages source is "GitHub Actions" (set 2026-10-13). Merging a pull request to `main` runs CI. When the `check` job passes, the `deploy` job in `.github/workflows/ci.yml` publishes the site within a few minutes. If CI is red, nothing is published and the live site keeps its last good version. The job uploads the site files with `include-hidden-files: true` (so `.well-known/security.txt` ships), leaves out tests, tools, `src`, CI files, `package.json`, `stryker.config.json` and other local files, and then checks the live pages (see `docs/RUNBOOK.md`, "How the site is published"). Generated files (`data/entries.*`,
`data/meta.json`, `*.html`) are committed, and CI fails if they are stale.

## Mentoring student contributors
- Review in public. Be specific and kind. Thank people by name.
- Never ask a minor to move the conversation to a private channel.
- Add a second adult maintainer if the project grows, so no young contributor depends on one person.
- Help a student write an accurate resume line about their work (see `CONTRIBUTORS.md`).
