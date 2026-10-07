# How to verify a program

Wrong information hurts real kids. Use this checklist every time you add or refresh a program.

## The rule
**No official page, no card.** A news story, a list on another site, or a social media post is a lead, not a source.

## Checklist
1. **Open the program's own website.** Not a copy on a school or aggregator site.
2. **Check these seven facts** and copy them in your own words:
   - Who can apply: ages, grades, where you live or go to school, citizenship or ID rules.
   - What students do (one or two plain sentences).
   - Pay: hourly wage, stipend, unpaid, or a cost to the student.
   - When: season, length, application opens and closes (with the year).
   - How to apply: form, essay, recommendation, interview.
   - Whether a California work permit is needed (any paid job under 18).
   - A direct link for applying, if there is one.
3. **If next year's dates are not posted**, write last year's dates in `deadline_text`, set `deadline_confidence` to `last-year-pattern`, and say so in `notes`.
4. **If the page blocks you or you cannot read it**, set `verified` to `snippet-only` and say why in `notes`. The site shows a "Confirm first" tag.
5. **Put every page you read in `sources_fetched`** and set `verified_on` to today's date.
6. **Run** `python3 tools/validate.py`.

## Red flags: do not list it
- The student pays money for a "guaranteed" internship or placement. (Expensive pre-college programs with a real university are allowed. Mark them `fee-based` with the cost.)
- The program asks for a Social Security number, bank account or a check before there is a job.
- You cannot find a real organization, address or phone number.
- It needs you to be 18 or a college student. (Put it in your pull request description so we can note it as "not for high schoolers".)

## Status values
| Status | Meaning |
|---|---|
| `open-now` | Accepting applications today |
| `opens-soon` | Not open yet. Set `opens_iso` to the opening date. |
| `closed-expect-reopen` | Closed for this cycle. It usually reopens around the month named in `deadline_text`. |
| `rolling` | Apply any time |
| `year-round` | Ongoing, no cycle (for example library volunteering) |
| `event` | A single event or fair |
| `unconfirmed` | We could not find current dates |

The website automatically shows an `open-now` program as "Closed" after its `deadline_iso`, and an `opens-soon` program as "Open now" on `opens_iso`. You still need to refresh the file for the next cycle.

## Priority
1 = great fit for many teens and easy to act on, 2 = good but narrower or competitive, 3 = niche.
