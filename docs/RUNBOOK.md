# Runbook: when main CI is red

Use this page when the CI badge on `main` is red, a bot opens an issue, or you are about to add a lot of programs. The usual cause is one of three things below. Find the failing step in the run first, then jump to the matching section.

## First, find what failed
1. Open the red run in the Actions tab and read the first failing step. CI runs, in order: validate, Python tests, JavaScript tests, rebuild and compare, dash scan (`CONTRIBUTING.md`, "What happens after you open a pull request").
2. Copy the failing test name. Test messages say what to change.
3. Reproduce it on your computer with the same command CI used (`python3 -m unittest discover -s tests -v` or `node --test tests/*.test.mjs`). Use the Node version in `.nvmrc`.
4. Do not weaken or delete a test to get green. Fix the cause, or change the pinned number on purpose with a reason (see below).
5. GitHub Pages publishes `main` whether or not CI passes (`docs/MAINTAINING.md`, "Releasing"). A red `main` can already be live, so fix it the same day.

## A date has passed
Signs: a test about dates or `opens_iso` and `deadline_iso` fails, or the daily bot opens an issue labeled `dates` (`.github/workflows/dates.yml`).

1. Run `python3 tools/flip_dates.py` for a dry run. It lists the cards due to flip and the cards it holds for a person.
2. Run `python3 tools/flip_dates.py --write` to flip the due cards. It changes only status and the two date fields.
3. For a held card, the deadline passed but `deadline_text` still says the program is open. Read the official page, then fix the card by hand and set `verified_on` to the day you read it (`docs/VERIFYING.md`).
4. Rebuild and test: `python3 tools/validate.py`, `python3 tools/build_data.py`, `python3 tools/build.py`, then both test commands.
5. Commit the program files and the regenerated files together.

## A timing test fails under load
Signs: a test that passes on your computer fails in CI, often with a timeout, a missing element, or a speed ceiling just missed. It passes on a rerun.

1. Rerun the failed job once. CI runners are shared and slow at times.
2. If it passes, note the test name in the issue or pull request. One pass is not proof the test is sound.
3. If the same test fails again, or fails on a second day, harden it. Replace a fixed sleep with polling: check for the thing the test needs every few milliseconds, up to a longer limit, and stop as soon as it appears. A page loads in jsdom through `tests/dom-helper.mjs` (`docs/TESTING.md`).
4. Do not raise a speed ceiling or remove an assertion to hide a flaky test. Make the wait honest instead.

## A byte budget fails after a data wave
Signs: `tests/r3-tests-4-size-ratchet.test.mjs` or the first-load weight tests in `tests/r1-perf-scale-1.test.mjs` fail after programs were added (`docs/TESTING.md`, "First-load weight ceilings").

1. Read the message. It names the file and its size.
2. Slim first: shorten long text and drop keys a page does not read. Adding cards is not a reason by itself to raise a limit.
3. If the growth is real and expected, raise the row to the measured size (the size on disk, rounded up a little). Write a dated note in the comment above the row: the date, the new size, the reason (for example "data wave, 40 new programs").
4. A first-load ceiling in `tests/r1-perf-scale-1.test.mjs` needs a person's approval for the extra phone weight. Write the approval in the pull request. Until it is recorded, mark the row pending approval.
5. A new file with no row fails on purpose. Add a row for it with a reason.

## How to add a data wave safely
A data wave is many new or changed programs in one pull request.

1. Keep a wave small enough to review. Split a very large one by hub (`docs/MAINTAINING.md`, "Regions and captains").
2. Create each file from `docs/program-template.json`, one `data/programs/<id>.json` per program. Follow `docs/VERIFYING.md`: official page only, every page read goes in `sources_fetched`, set `verified_on`. If a page cannot be read, set `verified` to `snippet-only`.
3. For a new region, follow `docs/ADDING_A_REGION.md` before the tools below.
4. Run in this order: `python3 tools/validate.py`, `python3 tools/build_data.py`, `python3 tools/build.py`, `node --test tests/*.test.mjs`, `python3 -m unittest discover -s tests`.
5. Fix failures. Expect counts, byte budgets and docs that quote program totals to move. Update them on purpose, with the notes described above.
6. Commit the program files with the regenerated files (`data/entries.json`, `data/entries.csv`, `data/meta.json`, the smaller data copies and the pages). CI fails if they are stale.
7. Open one pull request and say how many programs were added and which hub they cover.
8. After merge, watch the CI run on `main`. If it is red, use this page.

## How to read a link check report
The link check runs every Monday, with a wider run on Thursdays, and opens or updates one issue labeled `link-check` (`docs/MAINTAINING.md`, "Rhythm"). The full report is the `link-report` file on the workflow run, because a long report is cut short in the issue. The tool is `tools/linkcheck.py`.

The first line counts links: ok, blocked, broken, not checked. Then the sections:

| Section | Meaning | What to do |
|---|---|---|
| Broken | The program link gave 404, 410, a DNS or certificate error, or a server error twice in a row | Read the program's official page. Fix the link, or if the program ended, remove it by the method in `docs/VERIFYING.md` |
| Broken sources | A page listed in `sources_fetched` is gone (Thursday run) | Re-read the fact that page backed. Do not only swap the link |
| Broken aux links | A link in a hand-edited data file is broken (Thursday run) | Fix it in that file and check the fact it supports |
| Blocked or slow | The site refused a script, or timed out. Not a failure | Open the link in a browser. If it works, do nothing |
| Not checked | The 40 minute budget ran out first. Not counted as broken | Do nothing. They are tried next run |

After fixing, run the build commands and tests above, then comment on the issue with what you fixed. Do not close it for the bot.
