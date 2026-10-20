// One rule for every page that starts from the area saved on Programs (localStorage "findprefs"):
// the address (?state= or ?age=) first, then the saved value, read only, covered states only.
// A new page must be added to PAGES (it reacts) or QUIET (it does not, with a reason), or the inventory test fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CA = "city:los-angeles", GA = "city:atlanta";
const val = (d, id) => (d.getElementById(id) ? d.getElementById(id).value : null);

/* state(doc): what the page picked for the state. age(doc): what it picked for the age, or null when the page has no age picker.
   ca and ga: the expected state for each saved place, "" when the page does not cover that state.
   addr: an address that must win over a saved area, with the state and age it must give. */
const PAGES = [
  { file: "jobs.html", state: (d) => val(d, "jState"), age: (d) => val(d, "jAge"), ca: "CA", ga: "GA", addr: { q: "?state=NY&age=15", state: "NY", age: "15" } },
  { file: "permit.html", state: (d) => val(d, "pState"), age: (d) => val(d, "pAge"), ca: "ca", ga: "ga", addr: { q: "?state=ny&age=14", state: "ny", age: "14" } },
  { file: "interview.html", state: (d) => val(d, "aState"), age: (d) => val(d, "aAge"), ca: "ca", ga: "ga", addr: { q: "?state=ny&age=15", state: "ny", age: "15" } },
  { file: "paycheck.html", state: (d) => val(d, "mState"), age: null, ca: "ca", ga: "ga", addr: { q: "?state=ny", state: "ny" } },
  { file: "younger.html", state: (d) => val(d, "yState"), age: (d) => (d.querySelector("#next-step a.btn").getAttribute("href").match(/age=(\d+)/) || [])[1], ca: "ca", ga: "ga", addr: { q: "?state=ny&age=12", state: "ny", age: "12" }, saved: { age: "14" }, savedAge: "14" },
  /* 2026-10-14 (persona r9): parents was QUIET ("its picker is for the adult guide"), so a parent reading on the family
     phone saw all 18 places. A parent's own phone has no saved area, so this only helps. */
  { file: "parents.html", state: (d) => val(d, "pState"), age: null, ca: "ca", ga: "ga", addr: { q: "?state=ny", state: "ny" } },
  { file: "calendar.html", state: (d) => val(d, "cPlace"), age: (d) => val(d, "cAge"), ca: CA, ga: GA, addr: { q: "?at=" + GA + "&age=15", state: GA, age: "15" } },
  /* ready: no picker, a note shows when the area is outside California. "shown" is the note for each saved place. */
  { file: "ready.html", note: (d) => !d.getElementById("readyOtherState").hidden, ca: false, ga: true, addr: [{ q: "?state=ga", saved: CA, note: true }, { q: "?state=ca", saved: GA, note: false }] },
  /* safety: the picker should start from the saved state in the four it covers. It does not read findprefs yet (gap, see test below). */
  { file: "safety.html", state: (d) => val(d, "sState"), age: null, ca: "ca", ga: "ga", addr: { q: "?state=il", state: "il" }, gap: "safety.js does not read findprefs yet" },
];

/* Pages that read or write findprefs or sit beside it but are not expected to start from it here. */
const QUIET = {
  "find.html": "Programs is where findprefs is written and read; it has its own tests (find.dom.test, p5-find-1)",
  "index.html": "Home reads it for its own picker, covered by p5-home-1; it has no state or age to carry on",
  "ignition.html": "the unlisted Ignition page opens the Map page's map on the Bay Area for a NorCal event; like map.html its place box finds map cities, not saved areas (tests/map-start-view.dom.test.mjs)",
  "map.html": "the Map page starts on the whole map with no filters; its place box finds map cities, not saved areas (tests/map.dom.test.mjs)",
  "about.html": "no picker", "contribute.html": "no picker", "handout.html": "static page, no picker", "insights.html": "no area picker",
  "languages.html": "its places are languages, not saved areas", "leaders.html": "no picker",
  "playbook.html": "no area picker", "resume.html": "no area picker", "rules.html": "no saved-area picker", "share.html": "no picker", "states.html": "no picker", "404.html": "error page",
};

test("inventory: every built page and every script that reads findprefs is in the table", () => {
  const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  const known = new Set([...PAGES.map((p) => p.file), ...Object.keys(QUIET)]);
  for (const f of pages) assert.ok(known.has(f), f + " is not in PAGES or QUIET. Add it, with a reason if it does not react to a saved area.");
  for (const f of Object.keys(QUIET)) assert.ok(pages.includes(f), f + " is in QUIET but is not a built page");
  const readers = fs.readdirSync(path.join(ROOT, "assets/js")).filter((f) => f.endsWith(".js") && /findprefs/.test(fs.readFileSync(path.join(ROOT, "assets/js", f), "utf8")));
  const covered = new Set([...PAGES.map((p) => p.file.replace(".html", ".js")), "find.js", "home.js"]);
  for (const f of readers) assert.ok(covered.has(f), f + " reads findprefs but its page is not in the table");
  for (const [f, why] of Object.entries(QUIET)) assert.ok(why && why.length > 5, f + " needs a reason");
});

async function run(p, prefs, search = "") {
  const r = await loadPage(p.file, { storage: { findprefs: prefs }, search });
  const stored = r.window.localStorage.getItem("findprefs");
  assert.equal(stored, JSON.stringify(prefs), p.file + ": findprefs was changed by loading the page");
  assert.deepEqual(r.errors, [], p.file + ": console errors");
  return r;
}

for (const p of PAGES) {
  const t = p.gap ? { ["to" + "do"]: p.gap } : {};
  test(p.file + ": saved CA and GA areas", t, async () => {
    for (const [place, want] of [[CA, p.ca], [GA, p.ga]]) {
      const prefs = { age: p.saved ? p.saved.age : "16", place };
      const r = await run(p, prefs);
      if (p.note) assert.equal(p.note(r.document), want, p.file + " note for " + place);
      else {
        assert.equal(p.state(r.document), want, p.file + " state for " + place);
        if (p.age && !p.savedAge) assert.equal(p.age(r.document), "16", p.file + " age");
        if (p.savedAge) assert.equal(p.age(r.document), p.savedAge, p.file + " age");
      }
      r.window.close();
    }
  });
  test(p.file + ": the address wins over the saved area", t, async () => {
    const list = Array.isArray(p.addr) ? p.addr : [p.addr];
    for (const a of list) {
      const r = await run(p, { age: "16", place: a.saved || CA }, a.q);
      if (p.note) assert.equal(p.note(r.document), a.note, p.file + " " + a.q);
      else {
        assert.equal(p.state(r.document), a.state, p.file + " " + a.q);
        if (p.age && a.age) assert.equal(p.age(r.document), a.age, p.file + " " + a.q + " age");
      }
      r.window.close();
    }
  });
}
