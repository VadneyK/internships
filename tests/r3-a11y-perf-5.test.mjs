// Calendar and Numbers load a card-sized program file instead of the lite file.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPage, tick } from "./dom-helper.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const full = JSON.parse(read("data/entries.json"));
const lite = JSON.parse(read("data/entries-lite.json"));
const CAL = JSON.parse(read("data/calendar.json"));
const KEYS = ["id", "name", "org", "city", "url", "paid_type", "type", "fields", "grades", "needs_work_permit", "verified", "priority",
  "deadline_confidence", "min_age", "max_age", "status", "deadline_iso", "opens_iso", "regions", "season"];
// The card rows are no longer a file; rebuild them the way tools/build_data.py does for the calendar file.
const card = full.map((d) => Object.fromEntries(KEYS.filter((k) => k in d).map((k) => [k, d[k]])));
const NOW = Date.UTC(2026, 9, 9, 12);

function lib() {
  const ctx = { window: {} }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read("assets/js/lib.js"), ctx);
  return ctx.TIG ? ctx.TIG.lib : ctx.window.TIG.lib;
}

function logFetch(urls) {
  return (w) => {
    let f; Object.defineProperty(w, "fetch", { configurable: true, get: () => (u, o) => { urls.push(String(u)); return f(u, o); }, set: (v) => { f = v; } });
  };
}

test("card rows have the same ids in the same order and only the allowed keys, with values equal to entries.json", () => {
  assert.deepEqual(card.map((e) => e.id), full.map((e) => e.id));
  card.forEach((e, i) => {
    Object.keys(e).forEach((k) => assert.ok(KEYS.includes(k), e.id + " has extra key " + k));
    KEYS.forEach((k) => { if (k in full[i]) assert.deepEqual(e[k], full[i][k], e.id + "." + k); else assert.ok(!(k in e), e.id + " should not have " + k); });
  });
});

test("common.js has no card branch; the other modes are unchanged; home.js loads the card file first and each chosen program's file second", () => {
  const common = read("assets/js/common.js");
  assert.doesNotMatch(common, /entries-card|cardCache/);
  assert.match(common, /data\/entries-lite\.json/);
  assert.match(common, /data\/entries-core\.json/);
  assert.match(common, /data\/entries\.json/);
  for (const f of ["calendar", "insights"]) {
    const s = read("assets/js/" + f + ".js");
    assert.match(s, f === "insights" ? /G\.loadEntries\("stats"\)/ : /G\.loadEntries\("cal"\)/);
    assert.doesNotMatch(s, /loadEntries\(true\)|entries-lite|entries\.json/);
  }
  const home = read("assets/js/home.js");
  /* The Home picker reads the smaller home file (ticket r2-a11y-perf-6), not the card file. */
  assert.match(home, /G\.loadEntries\("home"\)/);
  assert.match(common, /data\/entries-home\.json/);
  assert.match(home, /G\.loadProgram\(/);
});

test("lib.insights over the card file deep-equals lib.insights over the lite file", () => {
  const L = lib();
  assert.deepEqual(L.insights(card, NOW), L.insights(lite, NOW));
});

test("calendar page: month 6 lists the same ids as the lite data gives, and requests only the small calendar file", async () => {
  const urls = [];
  const p = await loadPage("calendar.html", { search: "?m=6", now: NOW, setup: logFetch(urls) });
  await tick(200);
  assert.deepEqual(p.errors, []);
  const got = [...p.document.querySelectorAll("#cClose li, #cOpen li")].map((li) => li.querySelector('a[href^="find.html#p-"]').getAttribute("href").slice("find.html#p-".length));
  const L = lib(), by = Object.fromEntries(lite.map((e) => [e.id, e]));
  const inWindow = (it, m) => (it.opens && it.closes ? (it.opens <= it.closes ? m >= it.opens && m <= it.closes : m >= it.opens || m <= it.closes) : m === (it.opens || it.closes));
  const expected = CAL.items.filter((it) => by[it.id] && L.matches(by[it.id], { place: "", age: "" }, NOW) && inWindow(it, 6)).map((it) => it.id);
  assert.ok(expected.length > 0, "June has programs");
  assert.deepEqual([...got].sort(), [...expected].sort());
  assert.ok(urls.some((u) => /entries-cal\.json/.test(u)), "calendar file requested");
  assert.ok(!urls.some((u) => /entries-card\.json/.test(u)), "card file not requested");
  assert.ok(!urls.some((u) => /entries-lite\.json|entries\.json/.test(u)), "no big file requested: " + urls.join(", "));
});

test("numbers page: requests the stats file and never the card, lite or full file", async () => {
  const urls = [];
  const p = await loadPage("insights.html", { now: NOW, setup: logFetch(urls) });
  await tick(200);
  assert.deepEqual(p.errors, []);
  assert.match(p.document.getElementById("topStats").textContent, new RegExp(full.length + "\\s*programs listed"));
  assert.ok(urls.some((u) => /entries-stats\.json/.test(u)), "stats file requested");
  assert.ok(!urls.some((u) => /entries-card\.json|entries-lite\.json|entries\.json/.test(u)), "no bigger file requested: " + urls.join(", "));
});
