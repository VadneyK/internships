# Adding a region

This is the checklist for adding programs in a place the site does not cover yet: a new city, a new area, or a whole new state. `CONTRIBUTING.md` Path 3 only covers one new file in a region we already have. A new region needs several small edits in different files that must agree with each other. A test guards each edit, so a missed step shows up as a red check. This page lists every edit and the test that catches it.

Everything here is what the code and tests do today. If you change how the site works, change this page in the same pull request.

## Which steps do I need?

| What you are adding | Steps |
|---|---|
| A new city or county in a state the site already reads (for example a second city in Texas) | 1, 2, 3, 4, 5, 7, 8 |
| A new state, or a new Canadian province | All of them, 1 to 8. Step 6 is only for this case. |

"Read" means we have a work permit entry for that state in `data/permits.json`. The states we read today are the ones listed in `PERMIT_STATES` in `assets/js/lib.js`.

Do steps 3 to 6 before you run the tools in step 8. `python3 tools/validate.py` rejects a program file whose region id is not in the schema yet.

## Step 1. Research notes

Read the official pages first. Our rule is the same as everywhere else: no official page, no card.

Write two files in `docs/research/` (see `docs/research/README.md` for what the folder is):

- `docs/research/<region>-notes.md`. Look at `docs/research/oakland-notes.md` for the shape: a "What was searched" list, a "Gaps not closed" list, and "Tips for a teen in this region" where every tip ends with its source page.
- `docs/research/<region>-excluded.json`. A list of programs you looked at and left out. Each item has `name`, `url` and `reason` (see `docs/research/oakland-excluded.json`). Reasons we use: 18 and older only, college only, discontinued, could not verify, too local.

No test reads these two files, but the CI dash scan covers all text, so do not use the long dash characters.

## Step 2. Program files

Add one file per program in `data/programs`, named `<id>.json`.

- Start from `docs/program-template.json`. Field notes are in `data/schema/program.schema.json` and in `CONTRIBUTING.md` Path 3.
- Put the new region id in `regions`. A program that any teen in the whole state can use also gets the state-wide region id for that state (for example `statewide` for California, `texas` for Texas).
- If `city` ends in a state code such as `Austin, TX`, one of the regions must be in that state. Online or national programs use only `virtual` or `national` and leave the state code out of `city`.
- The file name must be the `id` plus `.json`. Two cards may not share an official `url`, or the same `org` and `name`.

What catches a mistake: `python3 tools/validate.py` (run by CI), and `tests/test_r1_data_hygiene_4.py` for the city and region match.

## Step 3. Schema enum and the REGIONS label

A region id has to appear in two places that must match exactly.

1. `data/schema/program.schema.json`: add the id to the `enum` list under `properties.regions.items`. There are 62 ids today.
2. `assets/js/lib.js`: add `["your-id", "Label teens will see"]` to the `REGIONS` list. The existing list puts `virtual` and `national` last, so add yours before them. The label shows on cards and in search.

Use lowercase words joined by hyphens, like the ids already there.

What catches a mistake: `tests/r3-tests-3.test.mjs`, test "regions: schema and L.REGIONS match both ways, no duplicate ids or empty labels".

## Step 4. Where picker: state, hub, city, area

Items 1 to 4 are in `assets/js/lib.js`. Items 5 and 6 are other files that must agree.

1. **STATE_OF.** Add `"your-id": "xx"` with the lowercase state code (`ca`, `tx`, and so on; `bc` for British Columbia). Every region except `virtual` and `national` needs a non-empty code. The code picks which permit text a program card shows. A region that is not listed shows no state's permit text on purpose, so never leave it out. The code must be in `PERMIT_STATES` (see step 6 for a new state).
2. **HUBS.** Every region must sit in at least one hub. A hub is `[id, "Label", [region ids]]`. Add the region to a hub that fits, or add a new hub. The Programs page shows the hub's known gaps and the Insights page counts by hub. Only ten hubs get a quick chip on the Programs page (the `QUICK` list in `assets/js/find.js`). Any hub still works from the address bar as `find.html?where=<hub id>`.
3. **CITIES.** The Where picker lists cities. A city is `[id, "Label", [region ids]]`. A city covers its own region plus the state-wide region, so list both (for example a Massachusetts city lists `boston` and `massachusetts`). California cities list `statewide`. The city must match at least one real program, or the picker would show "none yet".
4. **AREAS** (optional). A bigger area is `[id, "Label", [city ids]]`, like "Midwest". List city ids, not region ids.
5. If you added a new hub, also add its row to the hub table in `docs/MAINTAINING.md`, by copying an existing row and changing the id and label. The test wants the id in code font and the label exactly as it is in `HUBS`. If you gave a known gap this hub (step 5), also add the hub id to the hard-coded list in `tests/gaps.dom.test.mjs`.
6. `tests/test_r1_data_hygiene_4.py` keeps its own copy of the region-to-state map (`_GROUPS`). Add the region id to its state's line. For a new state add a new line, and add the two-letter code to `CODE_RE` in the same file so city codes are checked.

What catches a mistake:

- `tests/lib.test.mjs`, "every region maps to a state table entry, and unknown regions never fall back to California".
- `tests/r2-tests-6.test.mjs`, "every region except online and national has a state, a hub and a city".
- `tests/r2-tests-6.test.mjs`, "every member of CITIES and HUBS is a region id, and every AREAS member is a city id".
- `tests/r2-tests-6.test.mjs`, "every city and every area has at least one program in entries.json". Run step 8 first, because this reads the built `data/entries.json`.
- `tests/r3-tests-3.test.mjs`, "every region is in at least one hub, and every hub region exists".
- `tests/test_r1_data_hygiene_4.py`, `test_map_covers_every_schema_region`.
- `tests/r1-docs-ops-7.test.mjs`, "MAINTAINING lists every hub id and label from HUBS".

## Step 5. Known gaps

If you could not find or confirm programs you expect to exist, say so. Add an entry to `data/gaps.json`:

```json
{
  "id": "short-gap-id",
  "hubs": ["hub-id"],
  "title": "Plain title of what is missing",
  "text": "Which programs are missing and why they are not listed.",
  "issue": 123
}
```

- Open a GitHub issue first and use its real number in `issue`. Do not guess a number. The site links each gap to `https://github.com/VadneyK/internships/issues/<number>`.
- `hubs` are hub ids from `HUBS`. The Programs page shows the gap when someone picks that hub or a city in it. `tools/build.py` also puts every gap on the Contribute page, so rebuild after you edit.
- Plain words, and no em or en dash characters in `title` or `text`.

What catches a mistake:

- `tests/r1-tests-2.test.mjs`: every hub is a known hub id, every issue is a positive whole number, gap ids are unique.
- `tests/gaps.dom.test.mjs`: title and text exist, no dash characters, and the Contribute page links every issue.

## Step 6. New state only: permits and the state lists

Skip this step if the state is already in `PERMIT_STATES`.

**6a. `data/permits.json`.** Add a key under `states` using the same lowercase code you used in `STATE_OF`. Take every fact from the state labor department pages and the state minimum wage page. Put those pages in `links` (at least two) and put the date you read them in `read`. The keys of one state entry are:

| Key | What it holds |
|---|---|
| `name` | The state name |
| `read` | The date you read the pages |
| `permit` | The name of the permit, or what is needed instead |
| `needBelow` | A number. From this age up, no permit is needed. |
| `issuer` | Who issues or signs it |
| `steps` | At least three short steps |
| `bring` | At least one thing to bring |
| `timing` | How long it takes. "Not stated on the pages we read." is fine. |
| `renew` | When it must be renewed |
| `call` | Who to call or ask, with the web address |
| `links` | At least two items, each `{ "t": text, "u": web address }` |
| `hours` | Text for ages 14 to 15 under `"14"` and 16 to 17 under `"16"` |
| `wage` | The minimum wage text |
| `limits` | Numbers for the hours check, under `"14"` and `"16"`: `schoolDay`, `nonSchoolDay`, `schoolWeek`, `offWeek`, `earliest`, `latest`, and where the page gives them `latestSummer` and `weekdayOnly`. Use `null` when the page states no limit. |
| `minAge` | `{ "job": number, "note": text }`. The youngest age for most paid jobs. |
| `kinds` | One answer for each of the eight kinds in the top-level `kinds` list: `job`, `program`, `odd`, `own`, `volunteer`, `intern`, `family`, `acting`. Each is `{ "permit": true, false or null, "text": text }`. Use `null` when the pages do not say, and say so in the text. |
| `adult` | What changes at 18 |
| `district` | Optional. Only California has it. It adds a link to the school district picker on the Get ready page. |

A kind may also have `under: { below, permit, text }`, which replaces the answer for ages under `below`.

**6b. `assets/js/lib.js`.** In the same change:

- Add the code to `PERMIT_STATES`.
- Make sure every region you added in step 4 uses this code in `STATE_OF`.
- Change the count in the "We have read 17 states and British Columbia" sentence inside `permitFor` (the `nostate` answer). The number is the count of states other than British Columbia.

**6c. Other pages that show the count or list every state.**

- `src/permit.html`: the count in the `desc` line at the top and in the "Not listed?" paragraph.
- `src/states.html`: the "More States" number in `title`, `desc` and the first paragraph. That number counts every state except `ca`, `ga`, `ny`, `il` and `bc`.
- `data/parents.json`: add one row to `sign.states` (fields `id`, `name`, `permit`, `need`, `parent`, `call`, `p`) and update the count in the `note` text. The row order must match the key order in `permits.json`, so add the new state last in both files. `permit`, `call` and `need` (written as "Under N", or "No general permit") must match the permits entry word for word. `p` is `permit.html?state=<code>`.
- `README.md`: the two lines that say "13 more states" and "17 states and British Columbia".

The state pick lists on the permit finder and the States page build themselves from `permits.json`, so they need no edit.

**6d. Optional.** `data/transit.json` and `data/languages.json` rows may name the state. The state name must match the `name` in `permits.json`, or be "All states".

What catches a mistake:

- `tests/lib.test.mjs`, "PERMIT_STATES matches the states in permits.json" and "permits.json: every state answers every kind, with sources and no placeholder text" (also scans for dash characters, `undefined`, `NaN` and `TODO`).
- `tests/r2-tests-6.test.mjs`: "permits.json states match PERMIT_STATES exactly", "every non-empty STATE_OF value is a permit state, and PERMIT_STATES has no duplicates", "every permits kind exists in every state, and every state has the core fields", "every non-null limits band has a numeric or null schoolDay and nonSchoolDay", and "permitFor gives a verdict, headline and text for every state, age 12 to 18 and kind".
- `tests/r3-tests-1.test.mjs`: the permit page lists every state and works for every state, age 12 to 18 and kind.
- `tests/site.dom.test.mjs`, "permit and states pages: state counts match the non-BC keys in data/permits.json".
- `tests/parents.dom.test.mjs`: one row per state, same order, same permit name, phone and age rule.
- No test checks the count sentence in `assets/js/lib.js`, the count in `data/parents.json`, or the two lines in `README.md`. Search for the old number before you finish.

## Step 7. Optional: share card and QR code

A card on the Share page gives leaders a link and a printable QR code for one place. `CONTRIBUTING.md` has no QR section, so the steps are here.

1. Add a `("name", "find.html?where=<hub id>")` pair to `LINKS` in `tools/make_qr.py`.
2. Run that script as its header says. It needs the `segno` package and writes `assets/qr/<name>.svg`. It is not part of `tools/build.py`.
3. Add a matching `<article class="card qrcard" data-name="name">` to `src/share.html`. Copy an existing card. The `data-copy-link` must be the full link, `https://vadneyk.github.io/internships/` plus the path.

What catches a mistake: `tests/test_docs_sync.py`, "test_g_qr_links_match_share_page" (the card, the file, the title inside the file and `LINKS` must all agree).

## Step 8. Build and test

From the repo folder, in this order:

```bash
python3 tools/validate.py
python3 tools/build_data.py
python3 tools/build.py
python3 -m unittest discover -s tests
node --test tests/*.test.mjs
```

- `tools/build_data.py` makes `data/entries.json` and the other generated data files from `data/programs`. Run it after any change under `data/programs`.
- `tools/build.py` makes the pages in the repo root from `src` and `data/gaps.json`. Commit the results. CI fails if they are stale.
- Run `npm ci` once first if `node_modules` is missing.
- Open the live page at a phone width and a desktop width (see `docs/TESTING.md`). Pick your new city in the Where menu and check that your programs show.

## Step 9. Tests that fail if a step is skipped

| If you skip | These fail |
|---|---|
| Schema enum (step 3) | `tests/r3-tests-3.test.mjs` "regions: schema and L.REGIONS match both ways"; `tests/test_r1_data_hygiene_4.py` `test_map_covers_every_schema_region`; `tools/validate.py` on every program file that uses the id |
| REGIONS label (step 3) | the same `tests/r3-tests-3.test.mjs` test |
| STATE_OF (step 4) | `tests/lib.test.mjs` "every region maps to a state table entry..."; `tests/r2-tests-6.test.mjs` "every region except online and national has a state, a hub and a city" |
| Hub (step 4) | `tests/r3-tests-3.test.mjs` "every region is in at least one hub..."; the same `tests/r2-tests-6.test.mjs` test |
| City (step 4) | the same `tests/r2-tests-6.test.mjs` test |
| A city with no matching program | `tests/r2-tests-6.test.mjs` "every city and every area has at least one program in entries.json" |
| Python state map (step 4) | `tests/test_r1_data_hygiene_4.py` `test_map_covers_every_schema_region`, and the city and region match test |
| New hub row in `docs/MAINTAINING.md` | `tests/r1-docs-ops-7.test.mjs` "MAINTAINING lists every hub id and label from HUBS" |
| Gap hub or issue number (step 5) | `tests/r1-tests-2.test.mjs` and `tests/gaps.dom.test.mjs` |
| `PERMIT_STATES` or permits entry (step 6) | `tests/lib.test.mjs` "PERMIT_STATES matches the states in permits.json"; `tests/r2-tests-6.test.mjs` "permits.json states match PERMIT_STATES exactly" |
| Permits entry missing a kind or core field (step 6) | `tests/lib.test.mjs` "permits.json: every state answers every kind..."; `tests/r2-tests-6.test.mjs` "every permits kind exists in every state, and every state has the core fields" |
| State count on the permit and States pages (step 6) | `tests/site.dom.test.mjs` "permit and states pages: state counts match the non-BC keys..." |
| Parents row (step 6) | `tests/parents.dom.test.mjs` "parents.json: each state row matches data/permits.json..." |
| QR files (step 7) | `tests/test_docs_sync.py` "test_g_qr_links_match_share_page" |
| A path in backticks in a doc that does not exist | `tests/test_docs_sync.py` "test_e_backticked_repo_paths_exist" |

## Known limits

- The paycheck page and the ages 12 to 14 page (`younger.html`) only handle California, Georgia, New York and Illinois. Adding a state does not add it there. Their data is in `data/money.json` (the presets) and `data/younger.json` (the `states` list). The permit finder only links to those two pages for those four states. A new state gets the permit finder, the States page and the For parents table, and nothing else.
- Only ten hubs get a quick chip on the Programs page. A new hub is reachable from the Where menu and from `find.html?where=<hub id>`.
- The state-to-region map exists twice: in `assets/js/lib.js` and in `tests/test_r1_data_hygiene_4.py`. Keep them in step.
- The count sentences in `assets/js/lib.js`, `data/parents.json` and `README.md` are not tested. They go stale quietly.
