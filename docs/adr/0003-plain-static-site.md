# 0003. A plain static site with generated files committed

Status: Accepted (2026-10-13)

## Context
Students help run the project, so any of them should be able to read it. `CONTRIBUTING.md` says "No frameworks and no build step for the browser code." The site is served by GitHub Pages from the `main` branch (`docs/MAINTAINING.md`, "Releasing"), which does no build.

## Decision
- Plain HTML, CSS and JavaScript. No framework and no bundler in the browser.
- Page content lives in `src/`. Python scripts in `tools/` stamp the shared header and footer onto each page and combine the data files.
- The generated files are committed: the pages in the repo root, `data/entries.json`, `data/entries.csv`, `data/meta.json` and the smaller data copies.
- CI rebuilds them and fails if a committed copy is stale (`CONTRIBUTING.md`, "What happens after you open a pull request").
- Logic goes in `assets/js/lib.js` with a test. Page scripts only talk to the page.

## Consequences
- The site works on GitHub Pages with no build step, and a visitor's browser runs the same files a student can read.
- A contributor must run the build tools and commit the output, or CI fails.
- Never edit a generated file by hand. Edit the source and rebuild.
- Without a framework we write small helpers ourselves, such as `TIG.esc()` for escaping text.
