// Contributor docs accuracy for ticket r1-docs-ops-8: the CONTRIBUTING.md file map, the share page QR steps,
// the Path 4 links, the CI check order, and the "Where the tests live" section in docs/TESTING.md.
// Run with: node --test tests/r1-docs-ops-8.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const contrib = read("CONTRIBUTING.md");
const testing = read("docs/TESTING.md");
const ci = read(".github/workflows/ci.yml");
const makeQr = read("tools/make_qr.py");
const DASH = /[\u2013\u2014]/;
const rowOf = (doc, start) => doc.split("\n").find((l) => l.startsWith(start));
const sectionOf = (doc, heading) => {
  const i = doc.indexOf(heading);
  if (i < 0) return "";
  const next = doc.indexOf("\n#", i + heading.length);
  return doc.slice(i, next < 0 ? undefined : next);
};

test("neither doc has an em dash or en dash character", () => {
  assert.ok(!DASH.test(contrib), "CONTRIBUTING.md has a dash character");
  assert.ok(!DASH.test(testing), "docs/TESTING.md has a dash character");
});

test("the file map names the generated, hand-edited, QR and tools files", () => {
  for (const s of [
    "`data/entries-lite.json`", "`data/entries-core.json`", "`data/entries-card.json`",
    "`data/permits.json`", "`data/calendar.json`", "`data/interview.json`", "`data/languages.json`",
    "`data/money.json`", "`data/parents.json`", "`data/safety.json`", "`data/transit.json`",
    "`data/younger.json`", "`data/gaps.json`", "`assets/qr/*.svg`",
    "`tools/build.py`", "`tools/build_data.py`", "`tools/validate.py`", "`tools/proglib.py`",
    "`tools/linkcheck.py`", "`tools/freshness.py`", "`tools/make_qr.py`", "`tools/art.py`",
  ]) {
    assert.ok(contrib.includes(s), "CONTRIBUTING.md file map is missing " + s);
  }
});

test("each generated entries file says it is built by build_data.py and never edited, and names its readers", () => {
  const readers = { "entries-lite": ["find.js", "home.js"], "entries-core": ["younger.js"], "entries-card": ["calendar.js", "insights.js", "home.js"] };
  for (const [name, files] of Object.entries(readers)) {
    const row = rowOf(contrib, "| `data/" + name + ".json`");
    assert.ok(row, "no row for " + name);
    assert.ok(row.includes("tools/build_data.py"), name + " row does not name tools/build_data.py");
    assert.ok(row.includes("Never edit"), name + " row does not say never edit");
    for (const f of files) assert.ok(row.includes(f), name + " row does not name reader " + f);
  }
});

test("each hand-edited data file has a row that names the page script reading it", () => {
  const hand = ["permits", "calendar", "interview", "languages", "money", "parents", "safety", "transit", "younger", "gaps"];
  for (const name of hand) {
    const row = rowOf(contrib, "| `data/" + name + ".json`");
    assert.ok(row, "no row for data/" + name + ".json");
    assert.ok(row.includes("Hand-edited"), name + " row does not say hand-edited");
    assert.ok(row.includes("assets/js/"), name + " row does not name a page script");
    assert.ok(existsSync(join(root, "data", name + ".json")), "data/" + name + ".json is missing");
  }
});

test("the QR section gives the exact commands and the sync steps", () => {
  const sec = sectionOf(contrib, "### Share page and QR codes");
  assert.ok(sec, "missing the Share page and QR codes section");
  assert.ok(sec.includes("python3 -m venv v && v/bin/pip install segno && v/bin/python tools/make_qr.py"), "exact command missing");
  for (const s of ["assets/qr/<name>.svg", "segno", "Commit the SVG", "CI does not run", "LINKS", "data-name", "data-copy-link", "python3 tools/build.py", "src/share.html"]) {
    assert.ok(sec.includes(s), "share section is missing: " + s);
  }
  // the script itself says when to re-run it, and writes to assets/qr
  assert.ok(makeQr.includes("Re-run only when a link below changes"), "make_qr.py header no longer says when to re-run it");
  assert.ok(makeQr.includes('"assets", "qr"'), "make_qr.py no longer writes to assets/qr");
});

test("Path 4 links docs/MAINTAINING.md and docs/ADDING_A_REGION.md, and both files exist", () => {
  const row = rowOf(contrib, "| 4. Adopt a region");
  assert.ok(row, "no Path 4 row");
  assert.ok(row.includes("](docs/MAINTAINING.md)"), "Path 4 does not link MAINTAINING.md");
  assert.ok(row.includes("](docs/ADDING_A_REGION.md)"), "Path 4 does not link ADDING_A_REGION.md");
  assert.ok(existsSync(join(root, "docs/MAINTAINING.md")));
  assert.ok(existsSync(join(root, "docs/ADDING_A_REGION.md")));
});

test("the CI checks are listed in ci.yml order, in both the doc and the workflow", () => {
  const after = contrib.slice(contrib.indexOf("## What happens after you open a pull request"));
  const docMarks = ["tools/validate.py", "python3 -m unittest discover -s tests -v", "node --test tests/*.test.mjs", "Rebuild the data and pages", "Dash scan"];
  const ciMarks = ["python3 tools/validate.py", "python3 -m unittest discover -s tests -v", "node --test tests/*.test.mjs", "python3 tools/build_data.py", "No em dashes or en dashes in text"];
  for (const [label, text, marks] of [["CONTRIBUTING.md", after, docMarks], ["ci.yml", ci, ciMarks]]) {
    let last = -1;
    for (const m of marks) {
      const at = text.indexOf(m);
      assert.ok(at > last, label + ": missing or out of order: " + m);
      last = at;
    }
  }
});

test("TESTING.md has the Where the tests live section with the file rules and single-file commands", () => {
  const sec = sectionOf(testing, "## Where the tests live");
  assert.ok(sec, "missing the Where the tests live section");
  for (const s of ["test_*.py", "unittest", "node:test", ".dom.test.mjs", "tests/dom-helper.mjs", "r1-", "r2-", "r3-", "node --test tests/lib.test.mjs", "python3 -m unittest tests.test_tools -v"]) {
    assert.ok(sec.includes(s), "Where the tests live is missing: " + s);
  }
});

test("TESTING.md names the area of every round test file", () => {
  const files = readdirSync(join(root, "tests")).filter((f) => /^r[123]-.+\.test\.mjs$/.test(f));
  assert.ok(files.length > 0);
  for (const f of files) {
    const area = f.match(/^r[123]-(.+)-\d+\.test\.mjs$/)[1];
    assert.ok(testing.includes("`" + area + "`"), "TESTING.md does not name the area `" + area + "` of " + f);
  }
});

test("TESTING.md states no total test count", () => {
  assert.ok(!/\b\d[\d,]*\s+(tests|checks)\b/i.test(testing), "TESTING.md states a number of tests or checks");
});
