# Maintaining the guide

## Rhythm
| When | What | Who |
|---|---|---|
| Weekly (automatic, Mondays) | Link check (`tools/linkcheck.py`). It waits 1 second between requests to the same host (`--host-delay`) and stops starting new requests after 40 minutes (`--budget-minutes`). A broken link opens or updates an issue labeled `link-check`. Links it did not reach in time are listed under "Not checked" and are not counted as broken. Links that block scripts are listed under "Blocked or slow": open those in a browser. The full report is the `link-report` file on the workflow run, because a long report is cut short in the issue. | Bot, then any contributor |
| Monthly (automatic, 1st of the month) | Refresh list (`tools/freshness.py`). Opens an issue labeled `refresh` with a checklist of the 150 most urgent programs. The full list is the `refresh-full` file on the workflow run. | Bot, then hub captains |
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

## Handling an issue
1. Read the official page yourself. Do not trust the report alone.
2. Fix the program file (`data/programs/<id>.json`), set `verified_on` to today, add the page to `sources_fetched`.
3. Run the build commands in `CONTRIBUTING.md`, commit, open a pull request that says `Fixes #<issue>`.

## Releasing
The site is served by GitHub Pages from the `main` branch. Merging a pull request publishes it within a few minutes. Generated files (`data/entries.*`,
`data/meta.json`, `*.html`) are committed, and CI fails if they are stale.

## Mentoring student contributors
- Review in public. Be specific and kind. Thank people by name.
- Never ask a minor to move the conversation to a private channel.
- Add a second adult maintainer if the project grows, so no young contributor depends on one person.
- Help a student write an accurate resume line about their work (see `CONTRIBUTORS.md`).
