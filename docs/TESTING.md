# How we test

Every change goes through the same loop: build, test, deploy, check the live site, fix, improve, test again. A change is done when the live page behaves the way the pull request says it does.

## Automatic checks (run on every pull request)
| Check | What it catches | Run it yourself |
|---|---|---|
| `tools/validate.py` | A program file with a missing field, a bad date, a dash character, or a contradiction (for example a deadline with no confirmation) | `python3 tools/validate.py` |
| Python tests | The data tools themselves | `python3 -m unittest discover -s tests -v` |
| `tests/lib.test.mjs` | The filter, date and plan logic, with no browser | `node --test tests/*.test.mjs` |
| `tests/*.dom.test.mjs` | Real pages loaded in jsdom with their real scripts: click, type, and check what appears | `npm ci` once, then `node --test tests/*.test.mjs` |
| Rebuild and diff | Someone edited a generated page by hand or forgot to rebuild | `python3 tools/build_data.py && python3 tools/build.py && git status` |
| Dash scan | An em dash or en dash anywhere in the text | see `ci.yml` |

## Scheduled checks
Weekly link check, monthly "needs a re-check" issue, CodeQL.

## Checks a person does
jsdom does not draw anything, so layout and printing need eyes. Before a change to a page is called done, open the live page at a phone width (390 pixels) and a desktop width, look for text that overflows, and try the main action once. The pre-promotion checklist is in `ROADMAP.md`.

## Writing a page test
`tests/dom-helper.mjs` starts a tiny local server and gives you `loadPage("playbook.html")`, `type()` and `tick()`. Start from `tests/playbook.dom.test.mjs`.
