# Roadmap

## Quality bar before we promote it (Reddit, school newsletters, counselor lists)
- [ ] Every program is `verified: fetched` or clearly flagged
- [ ] Two adults and two teens have used the site start to finish and nothing confused them
- [ ] Accessibility check with a screen reader and keyboard only, 200% zoom, and a phone
- [ ] Each hub has at least one named region captain
- [ ] A Spanish version of the Home, Playbook and Rules pages, reviewed by a fluent speaker

## Ideas (good first issues are labeled in GitHub)
- Spanish, Chinese, Vietnamese and Tagalog translations
- A map view
- "Add to calendar" for deadlines
- A printable one-page "next 90 days" plan generated from the saved list
- A counselor guide: how to use the site with a class
- More hubs: Sacramento County deep dive, Contra Costa, Santa Cruz, North Bay
- A youth-run advisory group that reviews the site each quarter

## Youth-first design rules (added 2026-10-10)
These came from a review of how a 12 to 18 year old uses the site on a phone.
- **A fixed, readable guide beats a chat box.** Every answer is text a person wrote down, checked against an official page, and dated. The same question always gets the same answer, nothing a teen types leaves the browser, and a parent can read exactly what their teen sees. The parents page says this in plain words (section "How this guide works"). Do not add a live chatbot.
- **Tap, do not pick from a dropdown.** Short lists are big tap tiles (`TIG.tilePicker`, or `data-tiles` on a `<select>`); the real select stays in the page, hidden, so links, saved choices and tests still work. The Where picker is two taps: a part of the country, then a city (`PICK_GROUPS` in `assets/js/lib.js`). Lists longer than 30 stay a dropdown.
- **Show only what was picked.** An answer panel must never keep content for a place the teen did not choose (the ride picker once showed the Bay Area table under every city).
- **Answers are labelled panels, not an indented list.** `dl.facts` shows a small label over a short answer; "Not stated" is shown quietly.
- **Phone first.** The eight nav links fold behind one Menu button under 40rem. Tap targets are at least 44px.
- Ideas not built yet: a one-question-at-a-time version of the Get ready checklist; folding long pages (Get ready, Rules) into sections that open on tap; a "send this to a parent" button on every answer; remove the older "popular area" chips on Programs now that Where is two taps.
