# 0008. No child accounts: keep a list with a file, a link or a parent

Status: Accepted (2026-10-16)

## Context
A student asked for a way to download their search results, email them or save them to an account. The guide is for 12 to 18 year olds. Record 0002 already bans accounts, sign-in and tracking, and `src/about.html` promises that what a teen saves stays on their own device. An account or a mailing list would mean collecting a child's email address, which the owner has ruled out.

## Decision
- No child accounts and no collecting a child's email address, ever. The site never stores or sends an email address, not even to send a list.
- The saved list on the Programs page (`assets/js/find.js`, `state.saved`) can leave the device four ways, all made in the browser with no server:
  - Download my list: a plain text file built from the saved cards (name, place, ages, pay, dates, official page and the guide address) saved with a Blob and a download link.
  - Send to a parent: a mailto link that opens the teen's own mail app with a parent-friendly note, each program's official page and a Keep link. The To line is empty. The teen types the address.
  - Keep my list across devices: a link that carries the saved ids in the address, `find.html#saved=id1,id2`, capped at `KEEP_MAX` ids (`keepIds` in `find.js`, kept out of `lib.js` so the other pages do not carry it). The page reads it on load and asks before adding anything. It never overwrites a list already there.
  - Save and Load a backup file: a small `.json` file with the saved ids, for a long list or a backup. Loading goes through the same ask-before-adding panel.
- The Programs page says next to these buttons that we do not make accounts or collect emails, and that a parent or teacher can open the same link. The For parents page explains the four ways (`src/parents.html`, section "Your teen's list").
- The link holds program ids only: no name, no age, no place, no address.

## Consequences
- A teen can keep a list across devices, and hand it to an adult, with nothing stored anywhere but their own device and their own messages.
- Anyone who gets the link sees which programs were saved. The ids say nothing about who saved them.
- A long list does not fit in a link. The page says so and offers the backup file instead.
- `find.js` grows by about 6 KB, so its size rows in the budget tests were raised (record 0007).
- Tests: `tests/keep-my-list.dom.test.mjs` (the file text, the mail body, bad and repeated and too many ids in the link, the backup file, the ask-before-adding panel).
