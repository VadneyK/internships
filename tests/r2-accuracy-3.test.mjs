// Volunteering wording on the rules page: no unconditional-vs-condition conflict, and the examples stay (ticket r2-accuracy-3).
// Run with: node --test tests/r2-accuracy-3.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
// Reworded by ticket r3-accuracy-1: the quick answer now matches the no-permit list and sends only unnamed self-run work to the Labor Commissioner.
const QUICK = "true unpaid volunteering, with parent permission on file with your school, need no permit either. For other work you run yourself, such as tutoring, selling crafts or pet care, the page does not name it, so ask the Labor Commissioner at 833-526-4636.";
const BULLET = "Volunteering at a nonprofit, library, hospital, church, or school program";

test("src/rules.html quick answer sends unpaid nonprofit volunteering to the Labor Commissioner, with no permission-free claim", () => {
  const html = read("src/rules.html");
  assert.ok(html.toLowerCase().includes(QUICK.toLowerCase()));
  assert.equal(html.includes("with your parent's permission on file with your school (California regulation 5 CCR 10121)"), false);
});

test("src/rules.html 'Usually fine' bullet keeps hospital and church and has no permission clause", () => {
  const html = read("src/rules.html");
  assert.ok(html.includes(BULLET));
  const start = html.indexOf('<section id="unpaid">');
  const end = html.indexOf("</section>", start);
  const section = html.slice(start, end);
  assert.equal(section.includes("parent's permission on file"), false);
});

test("data/permits.json intern text carries the parent permission clause", () => {
  const permits = JSON.parse(read("data/permits.json"));
  const text = permits.states.ca.kinds.intern.text;
  assert.ok(text.includes("with your parent's permission on file with your school (California regulation 5 CCR 10121)"), text);
  assert.ok(text.includes("so no work permit"));
});
