// Repeated figures and counts agree across pages and data files (ticket r3-accuracy-7).
// Each figure is typed by hand in many places. This test checks that every form of the number is present in
// the files that must carry it, and that no second value shows up next to the same label. Failures name the
// file and line. Do not edit a figure here to make this pass: fix the source text, with its official source.
// Run with: node --test tests/r3-accuracy-7-repeated-figures.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  ...readdirSync(join(root, "src")).filter((f) => f.endsWith(".html")).map((f) => "src/" + f),
  ...readdirSync(join(root, "data")).filter((f) => f.endsWith(".json") && !f.startsWith("entries")).map((f) => "data/" + f),
];
const text = {};
for (const f of files) text[f] = readFileSync(join(root, f), "utf8");

// Tags and entities become plain text so a regex sees what a teen reads. Line numbers are kept.
const plain = (s) => s.replace(/<[^>]*>/g, "").replace(/&rsquo;|&#8217;|’/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const lineOf = (s, idx) => s.slice(0, idx).split("\n").length;

// Presence: name, regex that finds one form of the figure, files that must contain it.
const PRESENT = [
  ["California minimum wage $16.90", /\$16\.90/, ["src/rules.html", "data/permits.json", "data/money.json", "data/languages.json"]],
  ["California minimum wage $17.40", /\$17\.40/, ["src/rules.html", "data/permits.json", "data/languages.json"]],
  ["California fast food $20.00", /\$20\.00/, ["src/rules.html", "data/permits.json", "data/money.json"]],
  ["Chicago $17.05", /\$17\.05/, ["src/states.html", "data/permits.json", "data/money.json"]],
  ["Cook County $15.40", /\$15\.40/, ["src/states.html", "data/money.json"]],
  ["Illinois $13.00 for 650 hours", /\$13\.00/, ["src/states.html", "data/permits.json", "data/money.json"]],
  ["Illinois 650 hours", /\b650 hours/, ["src/states.html", "data/permits.json"]],
  ["$4.25 for 90 days", /\$4\.25/, ["src/states.html", "data/permits.json", "data/money.json"]],
  ["SDI 1.3 percent", /\b1\.3\s?(%|percent)|"1\.3"|\b1\.3\b/, ["src/ready.html", "data/money.json"]],
  ["Social Security 6.2", /\b6\.2\b/, ["src/paycheck.html", "src/ready.html", "data/money.json"]],
  ["Medicare 1.45", /\b1\.45\b/, ["src/paycheck.html", "src/ready.html", "data/money.json"]],
];

test("each repeated figure is present in every file that must carry it", () => {
  const missing = [];
  for (const [name, re, must] of PRESENT)
    for (const f of must) if (!re.test(plain(text[f]))) missing.push(`${f}: missing ${name}`);
  assert.deepEqual(missing, []);
});

// Conflicts: a label followed (within a short span, no sentence end) by a dollar or percent value.
// Every value found must be on the allow list for that label.
const LABELS = [
  ["California minimum wage", /California(?:'s)? (?:state )?minimum wage[^$.]{0,60}\$(\d+\.\d\d)/gi, ["16.90", "17.40"]],
  ["California fast food wage", /fast[- ]food[^$.]{0,80}\$(\d+\.\d\d)/gi, ["20.00"]],
  ["Chicago minimum wage", /(?<!outside )Chicago(?: is|:)?\s*\$(\d+\.\d\d)/g, ["17.05"]],
  ["Cook County minimum wage", /Cook County[^$.]{0,60}\$(\d+\.\d\d)/g, ["15.40"]],
  ["Illinois under-18 wage", /\$(\d+\.\d\d) for (?:their|your) first 650 hours/g, ["13.00"]],
  ["wage for first 90 days", /\$(\d+\.\d\d)(?: an hour)?[^.$]{0,30}first 90 consecutive days/g, ["4.25"]],
  ["SDI rate", /\bSDI\s*\(?(\d+(?:\.\d+)?)\s?(?:%|percent)/g, ["1.3"]],
  ["Social Security rate", /Social Security(?: tax is)?\s*\(?(\d+(?:\.\d+)?)\s?(?:%|percent)/g, ["6.2"]],
  ["Medicare rate", /Medicare(?: tax is)?\s*\(?(\d+(?:\.\d+)?)\s?(?:%|percent)/g, ["1.45"]],
];

test("no label has a second, conflicting value", () => {
  const bad = [];
  let seen = 0;
  for (const [name, re, ok] of LABELS)
    for (const f of files) {
      const t = plain(text[f]);
      for (const m of t.matchAll(re)) {
        seen++;
        if (!ok.includes(m[1])) bad.push(`${f}:${lineOf(t, m.index)}: ${name} is ${m[1]}, expected ${ok.join(" or ")}`);
      }
    }
  assert.ok(seen > 10, "label patterns found almost nothing; they may have drifted from the text");
  assert.deepEqual(bad, []);
});

// Counts in words must match data/permits.json.
test("state counts in words match data/permits.json", () => {
  const keys = Object.keys(JSON.parse(text["data/permits.json"]).states);
  const others = keys.filter((k) => k !== "bc");
  const n17 = others.length; // every state but BC (California is read too)
  const n13 = others.filter((k) => !["ca", "ga", "ny", "il"].includes(k)).length; // not California, Georgia, New York or Illinois
  const n30 = JSON.parse(text["data/states-lite.json"]).states.length; // the shorter answers: every state not in permits.json
  const bad = [];
  const sources = ["src/permit.html", "src/states.html", "data/parents.json", "assets/js/lib.js"];
  const body = Object.fromEntries(sources.map((f) => { const t = text[f] ?? readFileSync(join(root, f), "utf8"); return [f, f.endsWith(".html") ? plain(t) : t]; }));
  let n17Hits = 0, n13Hits = 0;
  for (const f of sources) {
    for (const m of body[f].matchAll(/(\d+) states and (?:British Columbia|BC)/g)) { n17Hits++; if (+m[1] !== n17) bad.push(`${f}:${lineOf(body[f], m.index)}: says ${m[1]} states, data has ${n17}`); }
    for (const m of body[f].matchAll(/(\d+) more states/g)) { n13Hits++; { const want = f === "src/states.html" ? n13 : n30; if (+m[1] !== want) bad.push(`${f}:${lineOf(body[f], m.index)}: says ${m[1]} more states, data has ${want}`); } }
  }
  // Four places carry the words (permit.html x2, parents.json, lib.js), as the message says. Set to 4 on 2026-10-11: the old 5 counted a place that no longer has them.
  assert.ok(n17Hits >= 4, "expected the '17 states and British Columbia' words in permit.html (x2), parents.json and lib.js");
  assert.ok(n13Hits >= 2, "expected the '13 more states' words in states.html");
  assert.deepEqual(bad, []);
});

// Agency phone numbers: the canonical number is in at least one page and one data file, and any number
// that follows the agency name closely is the canonical one.
const digits = (s) => s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
const PHONE = /\(?\b1?[-. ]?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/g;
const AGENCIES = [
  ["California Labor Commissioner", /Labor Commissioner/g, ["8335264636"]],
  ["Georgia child labor", /Georgia (?:DOL )?Child Labor/gi, ["8777098185"]],
  ["New York DOL", /New York (?:State )?(?:Department of Labor|DOL)/g, ["8884697365", "8885252267", "8774669757"]],
  ["Illinois child labor", /Illinois (?:Department of Labor )?child labor/gi, ["3127935570", "8006455784"]],
  ["federal Wage and Hour", /Wage and Hour/g, ["8664879243"]],
];

test("agency phone numbers match across pages and data", () => {
  const bad = [];
  for (const [name, re, ok] of AGENCIES) {
    const primary = ok[0];
    const found = new Set();
    for (const f of files) {
      const t = plain(text[f]);
      for (const m of t.matchAll(PHONE)) if (digits(m[0]) === primary) found.add(f);
      // states-lite.json rows name each other state's own office and phone (for example Nevada's Labor Commissioner or Maine's Wage and Hour Division), so a label there is not one of the five agencies above.
      if (f === "data/states-lite.json") continue;
      for (const a of t.matchAll(re)) {
        const win = t.slice(a.index, a.index + a[0].length + 90).replace(/\n/g, " ");
        const first = win.slice(a[0].length).match(PHONE);
        if (first && !ok.includes(digits(first[0])) && !otherAgencyBetween(win.slice(a[0].length, win.indexOf(first[0], a[0].length))))
          bad.push(`${f}:${lineOf(t, a.index)}: ${name} near ${first[0]}, expected ${ok.join(" or ")}`);
      }
    }
    if (![...found].some((f) => f.endsWith(".html"))) bad.push(`${name}: ${primary} not in any src page`);
    if (![...found].some((f) => f.endsWith(".json"))) bad.push(`${name}: ${primary} not in any data file`);
  }
  assert.deepEqual(bad, []);
});
// Another agency named between the label and the number means the number belongs to that agency.
function otherAgencyBetween(between) { return /Wage and Hour|Labor Commissioner|New York|Georgia|Illinois|California|federal|US DOL/i.test(between); }
