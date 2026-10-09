# Teen Internship Guide for California, Atlanta, New York and Chicago

[![CI](https://github.com/VadneyK/internships/actions/workflows/ci.yml/badge.svg)](https://github.com/VadneyK/internships/actions/workflows/ci.yml)
[![Links](https://github.com/VadneyK/internships/actions/workflows/links.yml/badge.svg)](https://github.com/VadneyK/internships/actions/workflows/links.yml)
![License: MIT](https://img.shields.io/badge/code-MIT-blue)
![Data: CC BY 4.0](https://img.shields.io/badge/data-CC%20BY%204.0-lightgrey)

**Live site: <https://vadneyk.github.io/internships/>**

A free, searchable guide to internships, paid youth programs, research, volunteering and job shadowing for high school students in
California, Atlanta, New York and Chicago, plus the work-permit rules, a message builder that helps you ask an adult for a chance, and a one-page resume builder.

It started as a handout for the "How to Find Internships" table at Ignition NorCal 2026 and grew into an open project that students help run.
It is an unofficial student resource. It is not an official publication of Ignition, Acts 2 Network or any program listed.

## What is in it

| Page | What it does |
|---|---|
| Programs | Filter by area, age, pay, season, kind and interest. Sort by next deadline. Save a list and print it. |
| Playbook | People map, a five-line message builder, templates, follow-up and thank-you, a tracker |
| Resume | What goes on a first resume and a builder that prints to PDF. Nothing leaves the browser. |
| Rules | California work permit steps, hours by age, minimum wage, unpaid internships, scams, online safety |
| Help build this | How students can add and verify programs and put the work on a resume |

## How it stays accurate

- Every program has its own small file in [`data/programs/`](data/programs) with the official URL, the pages we read, and the date we last verified it.
- CI validates the files against a [schema](data/schema/program.schema.json), runs tests, and fails if generated files are out of date.
- A bot checks every link weekly and opens an issue for broken ones. Another bot posts a monthly refresh list of programs whose dates passed or that were not re-checked in four months.
- The site flips a card from "Open" to "Closed, check back" on its own when the deadline passes.

Details: [docs/VERIFYING.md](docs/VERIFYING.md) and [docs/MAINTAINING.md](docs/MAINTAINING.md).

## Run it locally

```bash
git clone https://github.com/VadneyK/internships.git && cd internships
pip install jsonschema
python3 tools/validate.py && python3 tools/build_data.py && python3 tools/build.py
python3 -m http.server 8000     # open http://localhost:8000
```

Tests: `python3 -m unittest discover -s tests -v` and `node --test tests/`.

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
