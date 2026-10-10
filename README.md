# Teen Internship Guide for Many States and Vancouver, BC

[![CI](https://github.com/VadneyK/internships/actions/workflows/ci.yml/badge.svg)](https://github.com/VadneyK/internships/actions/workflows/ci.yml)
[![Links](https://github.com/VadneyK/internships/actions/workflows/links.yml/badge.svg)](https://github.com/VadneyK/internships/actions/workflows/links.yml)
![License: MIT](https://img.shields.io/badge/code-MIT-blue)
![Data: CC BY 4.0](https://img.shields.io/badge/data-CC%20BY%204.0-lightgrey)

**Live site: <https://vadneyk.github.io/internships/>**

A free, searchable guide to internships, paid youth programs, research, volunteering and job shadowing for high school students in
many states and Vancouver, BC, plus the work-permit rules, a message builder that helps you ask an adult for a chance, and a one-page resume builder.

It started as a handout for the "How to Find Internships" table at Ignition NorCal 2026 and grew into an open project that students help run.
It is an unofficial student resource. It is not an official publication of Ignition, Acts 2 Network or any program listed.

## What is in it

Each page is a plain HTML file in the repo root. The source for each one is in [`src/`](src).

| File | What it does |
|---|---|
| `index.html` | The home page, a free guide for high schoolers in the US and Vancouver, BC. |
| `find.html` | Search paid youth programs, internships, research, volunteer spots and shadowing that we could verify for teens. |
| `calendar.html` | Pick a month, a place and your age to see which teen programs take applications then. |
| `insights.html` | Charts about the program list: what is open now, how your age changes your options, and where the paid work is. |
| `younger.html` | What a 12 to 14 year old can do for money in four states, safety training for sitters, and how to get ready for a first job at 14. |
| `ready.html` | A checklist for your first job: a work permit at school, which papers to bring, how pay works, and rides to work. |
| `permit.html` | Pick your state, age and kind of work to see if you need a work permit, which one, and what to bring. |
| `states.html` | Plain work rules and who to call for teens in Georgia, New York, Illinois and 13 more states and British Columbia. |
| `rules.html` | Plain California answers on work permits, hours by age, minimum wage, unpaid internships, scams and safe contact with adults. |
| `paycheck.html` | Estimate a first paycheck in California, Georgia, New York and Illinois, understand the W-4 and state forms, and learn how to get unpaid wages. |
| `safety.html` | Your right to a safe workplace, jobs that people under 18 may not do, harassment, injuries, and who to call. |
| `languages.html` | Official pages in Spanish, Chinese, Korean, Vietnamese, Tagalog and Ukrainian on teen work rules, the W-4, wages and job scams. |
| `interview.html` | A free prep sheet that helps you plan your hours, practice 12 common interview questions, line up references and write a thank-you note. |
| `resume.html` | What goes on a first resume, how to turn babysitting and clubs into strong bullets, and a free builder that prints to PDF. |
| `playbook.html` | Build your people map, write a five-line message, follow up, and turn a yes into a real opportunity. |
| `parents.html` | Work permit forms by state, official pages in other languages, first paycheck facts and scam warnings for parents and guardians of 12 to 17 year olds. |
| `share.html` | Copy a link or print a QR code for the guide, each Ignition location and the main pages. |
| `contribute.html` | Check a program, add one, fix a link or improve the site, and put the work on your resume. |
| `about.html` | Who made the guide, how every program was checked, and how your privacy is protected. |

Three features are worth a closer look:

- **The Where picker.** On the Programs page (`find.html`), the Where menu lets you pick a city or area. It starts on Anywhere.
- **Work permit rules.** The permit finder covers 17 states and British Columbia. Its rules are kept in [`data/permits.json`](data/permits.json).
- **Share links and QR codes.** The Share page (`share.html`) makes a link you can copy and a QR code you can print for the guide and its main pages.

The guide lists more than a thousand programs. The exact number is in [`data/meta.json`](data/meta.json).

## How it stays accurate

- Every program has its own small file in [`data/programs/`](data/programs) with the official URL, the pages we read, and the date we last verified it.
- CI runs on every pull request. It checks every program file against the [schema](data/schema/program.schema.json), runs the tests, rebuilds the data and pages, and fails if generated files are out of date or if an em dash or en dash appears in the text.
- Every Monday, a bot checks the links in the program files. If any link is broken, it opens one issue labeled `link-check`, or adds a comment to that issue if one is already open.
- On the first day of each month, a bot builds a refresh list of programs that need a person to re-read the official page, such as a program whose deadline has passed or one nobody has checked in 120 days. If anything needs a look, it opens an issue labeled `refresh`. That issue lists only the most urgent items.
- CodeQL scans the code every Wednesday, and on every push to `main` and every pull request.
- The site shows a card as "Closed, check back" on its own when the deadline passes.

Details: [docs/VERIFYING.md](docs/VERIFYING.md) and [docs/MAINTAINING.md](docs/MAINTAINING.md).

## Run it locally

```bash
git clone https://github.com/VadneyK/internships.git && cd internships
pip install jsonschema
python3 tools/validate.py && python3 tools/build_data.py && python3 tools/build.py
python3 -m http.server 8000     # open http://localhost:8000
```

Tests: run `npm ci` once, then `node --test tests/*.test.mjs` and `python3 -m unittest discover -s tests -v`.

## Contribute

Students 13 and up are welcome. You can fix a date with a short form, add a program, adopt a region, or work on the code.
Start with [CONTRIBUTING.md](CONTRIBUTING.md). Teachers and club leaders: see [docs/CLASSROOM.md](docs/CLASSROOM.md) for a one-hour lesson plan.

## Design and tech

Plain HTML, CSS and JavaScript. No framework, no build step in the browser, no third-party requests (fonts are self-hosted).
Python scripts in `tools/` combine the data files and stamp a shared header and footer onto each page. Logic that matters (filtering, sorting,
status that changes with the calendar) lives in [`assets/js/lib.js`](assets/js/lib.js) and is unit tested.
The look borrows the orange, yellow and black of the Ignition NorCal 2026 flyer. No logos or art from the conference are used.

## License

Code: [MIT](LICENSE). Program data and written guides: [CC BY 4.0](LICENSE-DATA.md). Fonts: SIL Open Font License.
