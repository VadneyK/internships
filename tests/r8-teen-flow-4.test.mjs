// Ticket r1-teen-flow-4 (Ages 12 to 14 and Jobs): a closed "Words you will see" box for the hard words.
// Run with: node --test tests/r8-teen-flow-4.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// Each page, with the data files its text comes from.
const PAGES = [
  { page: "younger.html", data: ["data/younger.json"] },
  { page: "jobs.html", data: ["data/employers.json"] },
];

function wordsDetails(html) {
  return html.match(/<details\b[^>]*\bid="words"[^>]*>[\s\S]*?<\/details>/g) || [];
}

function pairs(box) {
  const dl = box.match(/<dl>([\s\S]*?)<\/dl>/);
  assert.ok(dl, "the words box has a dl");
  const out = [];
  const re = /<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g;
  let m;
  while ((m = re.exec(dl[1]))) out.push({ term: m[1].trim(), def: m[2].trim() });
  return out;
}

const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

for (const { page, data } of PAGES) {
  test(`${page}: exactly one closed details#words with the summary "Words you will see"`, () => {
    const html = read(page);
    const boxes = wordsDetails(html);
    assert.equal(boxes.length, 1, "one details with id words");
    const box = boxes[0];
    assert.match(box, /^<details id="words" class="callout plain small">/, "same opening markup as paycheck.html");
    assert.doesNotMatch(box.split(">")[0], /\bopen\b/, "closed by default");
    assert.match(box, /<summary>Words you will see<\/summary>/);
  });

  test(`${page}: every term is found in the page text or its data file, and each definition is under 40 words`, () => {
    const html = read(page);
    const box = wordsDetails(html)[0];
    const items = pairs(box);
    assert.ok(items.length > 0, "the box defines at least one term");
    const haystack = (text(html) + " " + data.map(read).join(" ")).toLowerCase();
    for (const { term, def } of items) {
      assert.ok(haystack.includes(term.toLowerCase()), `"${term}" appears in the page text or ${data.join(", ")}`);
      const words = def.split(/\s+/).filter(Boolean).length;
      assert.ok(words < 40, `definition of "${term}" is ${words} words`);
    }
  });

  test(`${page}: no dash characters in the box`, () => {
    const box = wordsDetails(read(page))[0];
    assert.doesNotMatch(box, /[\u2013\u2014]/);
  });
}
