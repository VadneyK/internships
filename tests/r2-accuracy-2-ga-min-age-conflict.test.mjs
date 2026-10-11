// r2-accuracy-2: Georgia minimum-age question. The finder note, the States page
// and younger.json must all name both the age 14 rule and the age 12 question,
// and the States page must carry the Georgia newspaper hours line.
// Run with: node --test tests/r2-accuracy-2-ga-min-age-conflict.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const PM = JSON.parse(read("data/permits.json"));
const YOUNGER = JSON.parse(read("data/younger.json"));
const STATES_SRC = read("src/states.html");
const STATES_BUILT = read("states.html");
const PHONE = "877-709-8185";

// Pull the Georgia Work permit card and Georgia Hours card out of the States page source.
function gaSection(html) {
  const start = html.indexOf('<section id="georgia">');
  const end = html.indexOf("</section>", start);
  assert.ok(start >= 0 && end > start, "Georgia section found");
  return html.slice(start, end);
}

function gaCard(html, title) {
  const sec = gaSection(html);
  const start = sec.indexOf(`<h3>${title}</h3>`);
  assert.ok(start >= 0, `Georgia card "${title}" found`);
  const end = sec.indexOf("</article>", start);
  return sec.slice(start, end);
}

test("permits.json Georgia minAge note names 14, 12 and the DOL phone number", () => {
  const note = PM.states.ga.minAge.note;
  assert.ok(note.includes("14"), note);
  assert.ok(note.includes("12"), note);
  assert.ok(note.includes(PHONE), note);
  assert.equal(
    note,
    "Federal law sets 14 for most non-farm jobs. The Georgia DOL summary sheet says the minimum age is 14. The state code mentions work certificates for some 12 and 13 year olds. Ask Georgia DOL: 1-877-709-8185."
  );
});

test("States page Georgia work permit text names 14, 12 and the DOL phone number", () => {
  for (const html of [STATES_SRC, STATES_BUILT]) {
    const card = gaCard(html, "Work permit");
    assert.ok(card.includes("14"), "contains 14");
    assert.ok(card.includes("12"), "contains 12");
    assert.ok(card.includes(PHONE), "contains phone");
  }
});

test("States page Georgia hours text has the 5 a.m. to 9 p.m. newspaper line", () => {
  for (const html of [STATES_SRC, STATES_BUILT]) {
    const card = gaCard(html, "Hours");
    assert.ok(
      card.includes("Under 16 may deliver newspapers in residential areas from 5 a.m. to 9 p.m. (Georgia child labor laws and rules)."),
      "newspaper line present"
    );
  }
});

test("younger.json Georgia conflicts[0] names 14, 12 and the DOL phone number", () => {
  const c = YOUNGER.conflicts[0];
  assert.ok(c.includes("Georgia"), c);
  assert.ok(c.includes("14"), c);
  assert.ok(c.includes("12"), c);
  assert.ok(c.includes(PHONE), c);
});
