// Counts written in words ("17 states and British Columbia", "1771 programs") must match the live data.
// Scans built root pages, README.md, assets/js/lib.js and data/*.json (not the big entries-*.json files).
// Rules for what is skipped (so a phrase about one city or one list is not read as a site total):
//  1. "more than / over / at least / about / nearly N ..." is a loose bound, not a count.
//  2. A "N programs" or "N cards" number under 100 is about a small group (for example the 6 programs one
//     contributor checked), not the whole site. Whole-site totals are in the thousands.
//  3. "N states" must say which list it means: "N states and British Columbia" (or "and BC") is the permit finder,
//     and a line about ages 12 to 14 means the Ages 12 to 14 page. Any other "N states" fails so someone looks.
//  4. "N cities" on a line about the ride picker means the transit places; otherwise distinct cities in the data.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const L = require(path.join(root, "assets/js/lib.js"));
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
const entries = readJson("data/entries.json");
const permits = readJson("data/permits.json");
const younger = readJson("data/younger.json");
const transit = readJson("data/transit.json");

const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
const live = {
  programs: entries.length,
  cities: new Set(entries.map((e) => e.city).filter(Boolean)).size,
  permitStatesNoBC: L.PERMIT_STATES.filter((s) => s !== "bc").length,
  youngerStates: Object.keys(younger.states).length,
  transitPlaces: Object.keys(transit.places).length,
  regions: L.REGIONS.length,
};

test("live counts agree with each other", () => {
  assert.equal(Object.keys(permits.states).length, L.PERMIT_STATES.length);
  assert.ok(permits.states.bc);
});

const re = new RegExp("(\\b(?:more than|over|at least|about|nearly|almost)\\s+)?\\b(\\d[\\d,]*|" + Object.keys(WORDS).join("|") + ")(\\+?)\\s+(states|programs|cards|cities|regions|places)\\b(\\s+and (?:British Columbia|BC))?", "gi");

function expected(noun, line, bc, file) {
  if (noun === "programs" || noun === "cards") return live.programs;
  if (noun === "regions") return live.regions;
  if (noun === "places") return [live.regions, L.CITIES.length];
  if (noun === "cities") return /\bride\b|transit/i.test(line) ? live.transitPlaces : live.cities;
  if (noun === "states") {
    if (bc) return live.permitStatesNoBC;
    if (/12 to 14|younger/i.test(line) || file === "younger.html") return live.youngerStates;
    return null;
  }
}

function check(file, text) {
  const bad = [];
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(re)) {
      if (m[1] || m[3]) continue; // rule 1
      const n = /^\d/.test(m[2]) ? Number(m[2].replace(/,/g, "")) : WORDS[m[2].toLowerCase()];
      const noun = m[4].toLowerCase();
      if ((noun === "programs" || noun === "cards") && n < 100) continue; // rule 2
      const want = expected(noun, line, !!m[5], file);
      const ok = want !== null && (Array.isArray(want) ? want.includes(n) : want === n);
      if (!ok) bad.push(`${file}:${i + 1} "${m[0].trim()}" expected ${want === null ? "a labelled list (see rule 3)" : [].concat(want).join(" or ")}`);
    }
  });
  return bad;
}

test("numbers in page prose, README, lib.js and data text match the data", () => {
  const files = [];
  for (const f of fs.readdirSync(root)) if (f.endsWith(".html")) files.push(f);
  files.push("README.md", "assets/js/lib.js");
  for (const f of fs.readdirSync(path.join(root, "data"))) if (f.endsWith(".json") && !f.startsWith("entries")) files.push("data/" + f);
  const bad = [];
  for (const f of files) {
    let t = fs.readFileSync(path.join(root, f), "utf8");
    if (f.endsWith(".html")) t = t.replace(/<script[^>]*>[\s\S]*?<\/script>/g, (s) => (s.includes("ld+json") ? s : "")).replace(/<[^>]+>/g, (tag) => tag.replace(/\s+/g, " ")); // keep attribute text such as meta descriptions
    bad.push(...check(f, t));
  }
  assert.deepEqual(bad, [], "Stale counts:\n" + bad.join("\n"));
});

test("the matcher catches a stale count", () => {
  assert.equal(check("x.html", "We have read 16 states and British Columbia.").length, 1);
  assert.equal(check("x.html", "We have read 17 states and British Columbia.").length, 0);
  assert.equal(check("x.html", "We list 1,700 programs.").length, 1);
  assert.equal(check("x.html", "more than 500 programs").length, 0);
});

// The permit finder says how many states it has full answers for (permits.json, minus BC) and how many it has
// shorter answers for (states-lite.json). The "not read" text in lib.js and the meta and og descriptions in permit.html
// must give both live counts, so a count that drifts from the data fails here, not only a number written as a fixed string.
// states-lite.json lists DC as well as states; DC is not a state, so the count of states excludes "dc" and DC is named.
const SHORT_STATES = readJson("data/states-lite.json").states.filter((s) => s.id !== "dc").length;
function permitCountGaps(text) {
  const gaps = [];
  if (!new RegExp(`\\b${live.permitStatesNoBC} states and (British Columbia|BC)\\b`).test(text)) gaps.push(`full count ${live.permitStatesNoBC} states and British Columbia (or BC)`);
  if (!new RegExp(`\\b${SHORT_STATES} more states and Washington, DC\\b`).test(text)) gaps.push(`shorter count ${SHORT_STATES} more states and Washington, DC`);
  return gaps;
}
function metaContent(html, key) {
  const m = html.match(new RegExp(`<meta\\s+(?:name|property)="${key}"\\s+content="([^"]*)"`));
  return m ? m[1] : "";
}

test("the permit finder's not-read text and page descriptions give the live full and shorter counts", () => {
  const v = L.permitFor(permits, "zz", 15, "job");
  assert.equal(v.verdict, "nostate");
  const html = fs.readFileSync(path.join(root, "permit.html"), "utf8");
  const surfaces = {
    "lib.js nostate text": v.text,
    "permit.html meta description": metaContent(html, "description"),
    "permit.html og:description": metaContent(html, "og:description"),
  };
  const bad = [];
  for (const [where, text] of Object.entries(surfaces)) {
    for (const gap of permitCountGaps(text)) bad.push(`${where}: missing ${gap}`);
  }
  assert.deepEqual(bad, [], "Stale permit counts:\n" + bad.join("\n"));
});

test("the permit count check catches a stale full or shorter count", () => {
  const good = "We have full answers for 17 states and British Columbia, and shorter answers for 33 more states and Washington, DC.";
  assert.deepEqual(permitCountGaps(good), []);
  assert.equal(permitCountGaps(good.replace("for 33 more", "for 34 more")).length, 1);
  assert.equal(permitCountGaps(good.replace(", DC", "")).length, 1);
  assert.equal(permitCountGaps(good.replace("17 states", "16 states")).length, 1);
  assert.equal(permitCountGaps("We have read 17 states and British Columbia.").length, 1);
});
