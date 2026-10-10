// Calendar and Numbers load a card-sized program file instead of the lite file.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPage, tick } from "./dom-helper.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const full = JSON.parse(read("data/entries.json"));
const lite = JSON.parse(read("data/entries-lite.json"));
const card = JSON.parse(read("data/entries-card.json"));
const CAL = JSON.parse(read("data/calendar.json"));
const KEYS = ["id", "name", "org", "city", "url", "paid_type", "type", "fields", "grades", "needs_work_permit", "verified", "priority",
  "deadline_confidence", "min_age", "max_age", "status", "deadline_iso", "opens_iso", "regions", "season"];
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

test("card file has the same ids in the same order and only the allowed keys, with values equal to entries.json", () => {
  assert.deepEqual(card.map((e) => e.id), full.map((e) => e.id));
  card.forEach((e, i) => {
    Object.keys(e).forEach((k) => assert.ok(KEYS.includes(k), e.id + " has extra key " + k));
    KEYS.forEach((k) => { if (k in full[i]) assert.deepEqual(e[k], full[i][k], e.id + "." + k); else assert.ok(!(k in e), e.id + " should not have " + k); });
  });
});

test("card file is compact JSON under 55 percent of the lite file", () => {
  const raw = read("data/entries-card.json");
  assert.equal(JSON.stringify(JSON.parse(raw)), raw.trim(), "compact JSON");
  const ratio = Buffer.byteLength(raw) / Buffer.byteLength(read("data/entries-lite.json"));
  assert.ok(ratio < 0.55, "card is " + Math.round(ratio * 100) + " percent of entries-lite.json");
});

test("common.js loads and caches the card file; the other modes are unchanged; home.js loads the card file first and the lite file second", () => {
  const common = read("assets/js/common.js");
  assert.match(common, /data\/entries-card\.json/);
  assert.match(common, /cardCache/);
  assert.match(common, /data\/entries-lite\.json/);
  assert.match(common, /data\/entries-core\.json/);
  assert.match(common, /data\/entries\.json/);
  for (const f of ["calendar", "insights"]) {
    const s = read("assets/js/" + f + ".js");
    assert.match(s, /G\.loadEntries\("card"\)/);
    assert.doesNotMatch(s, /loadEntries\(true\)|entries-lite|entries\.json/);
  }
  const home = read("assets/js/home.js");
  assert.match(home, /G\.loadEntries\("card"\)/);
  assert.match(home, /G\.loadEntries\(true\)/);
});

test("lib.insights over the card file deep-equals lib.insights over the lite file", () => {
  const L = lib();
  assert.deepEqual(L.insights(card, NOW), L.insights(lite, NOW));
});

test("calendar page: month 6 lists the same ids as the lite data gives, and requests only the card file", async () => {
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
  assert.ok(urls.some((u) => /entries-card\.json/.test(u)), "card file requested");
  assert.ok(!urls.some((u) => /entries-lite\.json|entries\.json/.test(u)), "no big file requested: " + urls.join(", "));
});

test("numbers page: requests the card file and never the lite or full file", async () => {
  const urls = [];
  const p = await loadPage("insights.html", { now: NOW, setup: logFetch(urls) });
  await tick(200);
  assert.deepEqual(p.errors, []);
  assert.match(p.document.getElementById("topStats").textContent, new RegExp(full.length + "\\s*programs listed"));
  assert.ok(urls.some((u) => /entries-card\.json/.test(u)), "card file requested");
  assert.ok(!urls.some((u) => /entries-lite\.json|entries\.json/.test(u)), "no big file requested: " + urls.join(", "));
});
