# Quality sweep, October 2026 (issue #9 and wider)

Date: 2026-10-16. Base: `main` at `fcafdb3`. Branch: `kentaro/quality-sweep-c9415d`.

Issue #9 asks for an accessibility check with a screen reader and keyboard only, at 200% zoom and on a phone. This sweep did the
keyboard, zoom, phone and automated parts in a real browser, and widened them to every page in the site root. It did **not** use a
real screen reader (VoiceOver, NVDA or TalkBack). That part of #9 is still open for a person.

## How it was checked

All checks ran in headless Chrome (Chrome for Testing 1223, Playwright) against a local copy of the built site, with the real
Content Security Policy on.

| Check | How | Pages |
|---|---|---|
| axe-core 4.14.0 | WCAG 2.0, 2.1 and 2.2 A and AA, plus best practice, color contrast on (jsdom cannot check it). Run at 320, 390, 768 and 1280 px wide, in light and dark | all 24 |
| Keyboard only | Tab from the top of the page to the end. First Tab must be the skip link, which moves focus to `main`. Every stop must show a focus ring, be on screen, and not sit inside `aria-hidden`. Checked whether anything covers the focused control. At 390 px: Menu opens with Enter and Space, Tab goes into the links, Escape closes it and returns focus | all 24, at 390 and 1280 (Programs, Parents, Rules also at 768 and 900) |
| Reflow and text size | 640 px (200% zoom of a 1280 px screen), 320 px (400%), 150% and 200% text at 390 px, 150% text at 1280 px, WCAG 1.4.12 text spacing at 390 px, Menu open at 320 px. Looked for page-wide side scroll, clipped text and sticky bars taller than a quarter of the screen | all 24 |
| Live regions | Listed every `aria-live` and `role=status` area on each page with a result count or answer | 18 interactive pages |
| Reduced motion | Read the CSS and every `scrollIntoView` and animation call in the page scripts | all scripts |
| Facts between pages | Minimum wages, permit ages and issuers, hours by age, fixed counts, dates. Compared the `src` pages with the JSON they read | all |
| Copy for a 13 year old | Jargon, long sentences, double negatives, vague buttons | all `src` pages and the JSON text they show |
| In-site links | 2,672 links and 455 `#fragment` targets, including links built in page scripts and `find.html#p-<id>` card links | all |
| Lighthouse | Tried with `lighthouserc.json` (mobile). The machine was overloaded (load average over 30, 14 test suites running at once), so runs timed out or gave no score. No usable numbers, see "Not verified" | none |

The 404 page was checked only for keyboard order. Its links start with `/internships/`, so a local server without that prefix loads it with no styles, and the axe results for it were not real.

## What was already good

These held on every page, at every width, in both themes:

- No axe violation for color contrast, landmarks, headings order, names, ARIA, target size (2.5.8) or anything else, except the Label in Name items below.
- The first Tab is a visible skip link. Enter moves focus to `main`, and the next Tab lands inside `main`.
- Every Tab stop shows a focus ring. No focus lands on a hidden control or inside `aria-hidden`. There is no positive tabindex.
- No side scroll at 640 px (200% zoom) or 320 px (400%), except Safe at work (A3).
- The Where picker works by keyboard. Group tiles say `aria-expanded`, and focus stays on the tile you pressed after the tiles redraw. The type-a-place box is a working combobox (arrows, Enter, Escape, `aria-activedescendant`).
- Each result count is in a live region: Programs `#countLive`, Calendar `#cCount`, Map `#mCount` and `#mNearStatus`, Languages `#lCount`, and a status area on every page with an answer.
- Reduced motion: `scroll-behavior` goes to `auto`, animations and transitions are off, and every scripted scroll checks `G.motionOK()`. The map tween checks it too.
- No broken in-site link or fragment. Every card link built in a script points at a real program id.
- Wages, permit ages and issuers, hours and counts agree across pages and JSON, except the items in "Facts" below.
- The site has no dialogs, so there was no dialog focus trap to test.

## Findings, most severe first

Status: **Fixed** means fixed in this branch with a test that locks it in. **Open** means it needs a person (a product choice, or a re-read of an official page).

### High

**F1. The hours planner used the summer 9 p.m. limit for every week off school. Fixed.**
- The interview page had one choice, "School is out (summer, break)". `lib.js` `hoursCheck` gave every week off the summer latest hour.
- The 9 p.m. rule for ages 14 and 15 runs June 1 to Labor Day only (`rules.html`, `states.html`, `permits.json`).
- A 14 year old planning 7 to 9 p.m. shifts over winter break was told "Within the limits we found". The real limit then is 7 p.m.
- Fix: the choices are now "School is in session", "Summer break" and "Another school break". `hoursCheck(limits, age, inSchool, days, notSummer)` keeps the school-time latest hour on a break outside summer, with the day-off and week-off caps.
- Tests: `tests/r12-accuracy-1-hours-breaks.test.mjs` (pure lib, added to Stryker's list) and `tests/r12-accuracy-2-sweep-facts.test.mjs`.
- Still open: Massachusetts starts its summer hours on July 1, not June 1 (`permits.json`), and "Summer break" uses the later hour all summer. See J4.

**A1. Keyboard users could not Tab into the phone Menu. Fixed.**
- `common.js` added the Menu button after the nav, right before the theme button.
- After opening the menu, Tab went to the theme button, then out of the header, and that closed the menu.
- The eight links could be reached only with Shift+Tab. This was on every page under 40rem wide (WCAG 2.4.3, 2.1.1).
- Fix: the button is now added before the nav. The tab order is Menu, the eight links, then the theme button. `.menu-btn + .theme-btn` became `.menu-btn ~ .theme-btn`, so the header row spacing is unchanged.
- Test: `tests/r12-a11y-perf-1-menu-tab-order.test.mjs`.

**A2. On tablets, the sticky header covered the control that had focus. Fixed.**
- From 40 to 64rem wide (641 to 1023 px at normal text), the sticky header wraps to three rows, about 213 px.
- The focus offset (`scroll-padding-top`) is 8rem (128 px).
- Tabbing through Parents and Rules at 768 and 900 px put links such as "Work permit by state" and "Minimum wage by city" under the header (WCAG 2.4.11).
- The same happens at 150% text on a 1280 px laptop: the header grew to 319 px, 40% of the screen.
- Fix: the header is sticky only from 64rem wide (and 34rem tall). At that width it is one row of links, 107 px, under the 8rem offset. Below 64rem it scrolls away with the page. This was measured from 900 to 1100 px: the header drops to 107 px at 1012 px.
- Tests: `tests/r12-a11y-perf-1-menu-tab-order.test.mjs`, updated `tests/r3-a11y-perf-26-sticky-header-short-screens.test.mjs` and `tests/a11y-scroll-padding.test.mjs`.
- This changes how tablets look. See J1.

**F2. British Columbia: the internship answer pointed to US federal law. Fixed.**
- `permits.json` BC `kinds.intern` said "the federal fact sheet is the guide". That means US Fact Sheet 71.
- The Jobs page says US rules do not apply in Canada.
- Fix: the text now says no BC page sets an internship rule, US rules do not apply in Canada, and to ask the BC Employment Standards Branch. It no longer states a rule, so it needs no new source.
- Test: `tests/r12-accuracy-2-sweep-facts.test.mjs`.

**F3. British Columbia light work at ages 12 and 13 reads two ways. Open (J2).**
- `employers.json` `bc-light-work-list-12-to-15` says children 12 to under 16 can do the listed light work (cashier, server and others).
- `permits.json` BC steps and `employers.json` `bc-light-work-14-15` say light work is an exception at 14 and 15 only.
- `permits.json` BC `kinds.job` says "ages 12 to 15 may need a child employment permit unless the work is light work".
- A 12 year old in BC could take a cashier job thinking no permit is needed. This needs a re-read of the BC Employment Standards pages before the text changes.

### Medium

**A3. Safe at work scrolled sideways at 320 px. Fixed.**
- `a[href^="tel:"] { white-space: nowrap; }` kept "1-866-4-US-WAGE (1-866-487-9243)" on one line, 21 px wider than a 320 px screen (WCAG 1.4.10).
- Fix: tel links are now `display: inline-block`. A number moves to the next line whole, and wraps only when it is wider than the line.
- Tests: `tests/r12-a11y-perf-1-menu-tab-order.test.mjs`, updated `tests/parents-stack-table.dom.test.mjs`.

**A4. Programs area chips and Calendar month chips failed Label in Name (WCAG 2.5.3). Fixed.**
- axe `label-content-name-mismatch` fired at every width.
- The seen text ran the count into the word ("Silicon Valley86", "Jan28"). The month chip name said "January" while the chip shows "Jan".
- A voice control user saying "click Jan" did not match.
- Fix: a space before the count on both chip kinds (in `find.js`, `calendar.js` and the build-time chips in `tools/build.py`). The month chip name now starts with the shown month ("Jan, 28 programs").
- Test: `tests/r12-a11y-perf-2-label-in-name.test.mjs`, which also sweeps every built page for a labelled link or button whose seen words are not in its name.

**F4. The parents page gave a stale permit finder count and the wrong choice to pick. Fixed.**
- `parents.json` said "We have read 17 states and British Columbia so far" and told parents to pick "My state is not listed".
- 33 more states and DC have shorter answers under "Another state", so a parent in Oregon was sent past their state's answer.
- Fix: the note now gives both counts and names both choices.
- Test: `tests/r12-accuracy-2-sweep-facts.test.mjs`.

**F5. Two "British Columbia work permit answer" links opened an empty finder. Fixed.**
- On First paycheck and Get ready, the links went to `permit.html` with no state. They now go to `permit.html?state=bc`.
- Test: `tests/r12-accuracy-2-sweep-facts.test.mjs`, which also opens the finder on BC.

**F6. Get ready names the B1-4 as the form a foster parent or caregiver signs. Open (J3).**
- `src/ready.html` foster care box links `B1-4frm.doc` as the form "a parent or guardian, a foster parent, a caregiver" can sign.
- Every other page says the parent signs the Statement of Intent (B1-1) and the school issues the permit (B1-4).
- One of them is wrong, or the B1-4 really has a caregiver line. This needs a re-read of the CDE form.

**F7. New York's 9 p.m. window for ages 14 and 15. Open (J4).**
- `permits.json` and `states.html` allow 9 p.m. "when school is closed".
- New York's rule is usually given as June 21 to Labor Day. This needs a check against the New York P882 guide. If it is a fixed window, the new "Another school break" choice already handles winter break, but June 1 to June 20 would still be wrong.

### Low

**A5. Numbers page age bars do not match Label in Name word for word. Open (judgment).**
- Each bar link shows the count, "Age 13" and two split counts. Its name reads them as a sentence: "Age 13: 1602 programs, 246 paid ...".
- The "Age 13" part a person would say does match. Making it pass exactly would need an awkward name.
- It is listed as KNOWN in `tests/r12-a11y-perf-2-label-in-name.test.mjs`.

**A6. Large text on a phone scrolls sideways on five pages. Open.**
- At 150% text on a 390 px phone, these scroll 8 to 117 px:
  - Programs: the "Deadline in the next 60 days" tile does not wrap.
  - Numbers: the stat boxes.
  - Resume: the nowrap "Expected June 2028" line.
  - Safe at work: the hotline list, now much less after A3.
  - Map.
- At 200% text most pages scroll.
- WCAG 1.4.4 allows side scroll at 200% text, and 1.4.10 (320 px) passes. It still hurts teens who use big text on Android. A wrap rule for each item is a small CSS change each, but `style.css` has 111 bytes left under its budget (see J5).

**A7. Inline "Official page" links on Home cards are 22 px tall.**
- axe target size (24 px or enough space) passes, because of the spacing exemption.
- The ROADMAP rule says 44 px for tap targets. These are links inside text, which the rule usually leaves out. Listed so a person can decide.

**F8. Georgia's wage line said "pay the federal rate instead" twice. Fixed.**
- `state-wages.json` Georgia `wage` ended with the sentence that `G.wageLine` adds for every below-federal state.
- The sentence is now only in the code. Test: `tests/r12-accuracy-2-sweep-facts.test.mjs`.

**F9. The Cook County pointer on the parents page went to the top of More states. Fixed.**
- `parents.json` linked `states.html#other`. The Cook County rate is in the Illinois section, so the link now goes to `#illinois`.
- Tests: updated `tests/r2-accuracy-4-cook-county.test.mjs`, and `tests/r12-accuracy-2-sweep-facts.test.mjs`.

**F10. The contribute page still asked for a map. Fixed.** `map.html` exists. The words "or add a map" are gone.

**F11. Smaller copy and fact notes. Open.**
- "Four things make a first application strong" (`parents.json`) and "Five parts" (`interview.html`) are two lists.
- `permit.html` says "Most pages last read Oct 9, 2026", but the 34 shorter answers and the wage lines were read Oct 10.
- `README.md` says "more than a thousand programs". The count is 2,610.
- `employers.json` DC summer program pay of $10.00 an hour is under DC's $18.40 minimum wage. It may be a stipend rate, so confirm it.

**C1. Copy a 13 year old may not follow. Open (judgment).**

These are the clearest spots. Each needs a short rewrite in the house voice:

| Where | Words | Plain idea |
|---|---|---|
| `rules.html`, `ready.html` | "certificate of proficiency" | say what it is (the CHSPE test) |
| `rules.html` | "personal-attendant work are exempt from the state minimum wage" | "Babysitting does not have to pay minimum wage" |
| `ready.html` | "E-Verify", "notarized", "no federal income tax liability" | say what each one means |
| `paycheck.html` | "a sole proprietorship, or a partnership" | "My parent owns the business alone or with my other parent" |
| `states.html`, `safety.html` | "not required if you are not being paid", "A gap does not mean a right does not exist." | remove the double negative |
| `index.html` | button "See how" | say where it goes |
| `interview.html` | button "Use Monday for Tuesday to Friday" | "Copy Monday to Tuesday through Friday" |
| `contribute.html` | "hub ... every quarter" | "area ... every 3 months" |
| `insights.html`, `map.html` | "Paid or stipend" | explain stipend once |

There are no em or en dashes and no "click here" links.

### Map (for PR #37, not changed here)

PR #37 rebuilds `map.html`, so the map was checked on `main` and not changed.

- axe: no violations at any width, in either theme.
- Keyboard: tab order is clean, with a focus ring on every stop. The Menu order bug (A1) is on the map page too, but the fix in `common.js` covers it.
- Large text: 8 px side scroll at 150% text on a 390 px phone, and the count chips (`span.n`) push the page about 120 px wide at 200% text.
- Reduced motion is respected (`anim` gates the zoom tween and `scrollIntoView`).
- `map.html#g-<code>` links are built at runtime by the same script that makes those ids, so a link check cannot confirm them. That is low risk.

## Needs a person's judgment

- **J1. Tablet header.** Is it OK that the header now scrolls away on screens 641 to 1023 px wide (A2)? The other way is a much larger focus offset (about 14rem) on tablets, which keeps a 213 px header over the page.
- **J2. BC light work at 12 and 13 (F3).** Re-read the BC Employment Standards light work pages and pick the right wording.
- **J3. Foster care form (F6).** Is the caregiver signature on the B1-1 or the B1-4?
- **J4. Summer windows (F1, F7).** Massachusetts starts July 1, and New York may start June 21. Should "Summer break" show each state's summer dates, or should those states get a dated note?
- **J5. Large text on phones (A6).** Worth spending the `style.css` budget on wrap rules? Most budget rows are already marked PENDING PERSON APPROVAL.
- **J6. Copy rewrites (C1, F11)** and the Numbers bar names (A5).

## Not verified

- **Screen readers.** No VoiceOver, NVDA or TalkBack pass was done. Issue #9 stays open for that.
- **Lighthouse.** No usable scores. The machine was overloaded and runs timed out. The weekly Lighthouse workflow has the real numbers.
- **The 404 page with styles.** axe on 404 was not meaningful locally (see "How it was checked").
- **Real devices.** Phone layout was checked in headless Chrome at phone widths, not on an iPhone or Android phone. Text size was tested by setting the root font size. That matches Chrome's own text size setting for rem-based layouts, but not iOS Dynamic Type.
