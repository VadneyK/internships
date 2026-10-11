// The "last read" date written in a page lede must match the read field of its
// JSON file (ticket r3-accuracy-7). Dates are typed by hand on both sides, so
// re-reading a file and updating only one side makes the page claim a
// freshness the data does not have.
// Run with: node --test tests/read-dates.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DATE_RE = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})/g;
const iso = (s) => {
  const m = /^(\w{3}) (\d{1,2}), (\d{4})$/.exec(s);
  assert.ok(m, `bad date text: ${s}`);
  return `${m[3]}-${String(MON.indexOf(m[1]) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
};
const text = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const json = (rel) => JSON.parse(text(rel));

// Sentences that carry a read date: they contain "last read" or "was read".
function stampSentences(html) {
  const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return plain
    .split(/(?<=\.)\s+(?=[A-Z])/)
    .filter((s) => /last read|was read/i.test(s) && /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}/.test(s));
}

const PAGES = [
  ["paycheck", "money"],
  ["younger", "younger"],
  ["permit", "permits"],
  ["interview", "interview"],
  ["languages", "languages"],
];

for (const [page, file] of PAGES) {
  test(`${page}.html last read dates match data/${file}.json`, () => {
    const data = json(`data/${file}.json`);
    const dataRead = iso(data.read);
    const caRead = data.states && data.states.ca && data.states.ca.read ? iso(data.states.ca.read) : null;
    const sentences = stampSentences(text(`src/${page}.html`));
    assert.ok(sentences.length > 0, `${page}.html has no last read sentence`);
    let seen = 0;
    for (const s of sentences) {
      const dates = [...s.matchAll(DATE_RE)].map((m) => m[0]);
      for (const d of dates) {
        seen++;
        const want = file === "permits" && /California/.test(s) && /was read/i.test(s) ? caRead : dataRead;
        assert.equal(iso(d), want, `${page}.html says "${d}" in "${s.trim()}" but the data says ${want}`);
        assert.ok(iso(d) <= dataRead || iso(d) === caRead, `${page}.html date ${d} is later than its data`);
      }
    }
    assert.ok(seen > 0, `${page}.html: no date found`);
  });
}
