# Maintaining the guide

## Rhythm
| When | What | Who |
|---|---|---|
| Weekly (automatic) | Link check. A broken link opens an issue labeled `link-check`. | Bot, then any contributor |
| Monthly (automatic) | Refresh list. Opens an issue labeled `refresh` with a checklist. | Bot, then region captains |
| Each quarter | Region captains re-read every official page in their region and update files | Volunteers |
| Each August | New school year: roll deadlines forward, check every summer program for the next cycle | Everyone |
| Each January | Re-check the California minimum wage and work-permit pages on the Rules page | Maintainer |

## Regions and captains
`davis` (Davis, Yolo, Sacramento), `sv` (Santa Clara and San Mateo counties, Fremont), `oak` (Oakland, Berkeley, Alameda, East Bay), `sf`, `state`, `online`.
A captain is anyone who agrees to do the quarterly pass for a region. List captains in `CONTRIBUTORS.md`.

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
