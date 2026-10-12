// diet-1: the Programs page loads only the chosen place's Where group files (data/lite/<group>.json) plus the shared online and national
// file, instead of the whole lite file, and draws exactly what the whole file draws.
//
// What this checks:
// - the URL lists in find.js (written out one by one, because a test forbids computed fetch URLs) match the files the build writes
// - the chunk files hold the same cards as entries-lite.json and entries-detail.json, in id order, and no card is lost for any place
// - for every city, area and state (with and without the online and national widening) the chunks give the same cards in the same order as the whole file
// - find.html?at=... draws the same count, cards, chip counts, place list, picks and notes as the same page forced onto the whole lite file
// - a place the chunks cannot answer (a search, an area chip, no place, a saved card outside them) falls back to the whole file and still matches
// - the first-load data bytes for three sample places are pinned
// Run with: node --test tests/diet-1-region-chunks.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const L = require(path.join(ROOT, "assets/js/lib.js"));
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const json = (f) => JSON.parse(read(f));
const slug = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);
const byIdOrder = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const lite = json("data/entries-lite.json");
const detail = json("data/entries-detail.json");
const GROUP_SLUGS = L.PICK_GROUPS.map((g) => slug(g[0]));
const FILES = [...GROUP_SLUGS, "shared"];

// The literal URL arrays in find.js, read from the source text.
function arrayIn(src, name) {
  const m = new RegExp("var " + name + " = (\\[[^\\]]*\\]);").exec(src);
  assert.ok(m, "find.js has var " + name);
  return JSON.parse(m[1]);
}
const findSrc = read("assets/js/find.js");

test("the URL lists in find.js match the files the build writes, in PICK_GROUPS order then shared", () => {
  assert.deepEqual(arrayIn(findSrc, "LITE"), FILES.map((f) => "data/lite/" + f + ".json"));
  assert.deepEqual(arrayIn(findSrc, "DET"), FILES.map((f) => "data/detail/" + f + ".json"));
  const onDisk = (d) => fs.readdirSync(path.join(ROOT, d)).sort();
  assert.deepEqual(onDisk("data/lite"), FILES.map((f) => f + ".json").sort());
  assert.deepEqual(onDisk("data/detail"), FILES.map((f) => f + ".json").sort());
  assert.equal(new Set(FILES).size, FILES.length, "group slugs are unique");
});

test("find.js fetches chunks only through literal URLs (no URL is built from a place name)", () => {
  assert.ok(!/G\.fetchData\([^)]*\+/.test(findSrc), "no concatenated fetch argument");
  assert.ok(!/fetchData\(\s*`/.test(findSrc), "no template literal fetch argument");
});

const chunk = (kind, f) => json("data/" + kind + "/" + f + ".json");
const liteChunks = Object.fromEntries(FILES.map((f) => [f, chunk("lite", f)]));
const detailChunks = Object.fromEntries(FILES.map((f) => [f, chunk("detail", f)]));

test("every chunk row is the exact lite row (and detail row), in id order, in the right file", () => {
  const liteById = new Map(lite.map((e) => [e.id, e]));
  const detById = new Map(detail.map((e) => [e.id, e]));
  for (const f of FILES) {
    const rows = liteChunks[f], det = detailChunks[f];
    assert.deepEqual(rows.map((e) => e.id), [...rows].sort(byIdOrder).map((e) => e.id), f + " is in id order");
    assert.deepEqual(det.map((e) => e.id), rows.map((e) => e.id), f + " detail file has the same ids in the same order");
    for (const e of rows) assert.deepEqual(e, liteById.get(e.id), f + " " + e.id);
    for (const e of det) assert.deepEqual(e, detById.get(e.id), f + " detail " + e.id);
    if (f === "shared") assert.ok(rows.every((e) => (e.regions || []).some((r) => r === "virtual" || r === "national")), "shared holds only online and national cards");
    else assert.ok(rows.every((e) => !(e.regions || []).some((r) => r === "virtual" || r === "national")), f + " holds no shared card");
  }
});

const allPlaces = [
  ...L.CITIES.map((c) => "city:" + c[0]),
  ...L.AREAS.map((a) => "area:" + a[0]),
  ...L.STATES.map((s) => "state:" + s[0]),
];

// The chunk numbers find.js picks for a place, read from the real page (the test hook G.placeChunks).
let chunksOf;
test("find.js maps every city, area and state to Where groups", async () => {
  const { window } = await loadPage("find.html", { search: "?at=city:boston" });
  chunksOf = (p) => { const r = window.TIG.placeChunks(p); return r && Array.from(r); };
  for (const p of allPlaces) {
    const idx = chunksOf(p);
    assert.ok(Array.isArray(idx), p + " maps to chunks");
    assert.ok(idx.includes(FILES.length - 1), p + " always includes shared");
  }
  assert.equal(chunksOf("city:nowhere"), null);
  assert.equal(chunksOf("area:nowhere"), null);
  assert.equal(chunksOf(""), null);
  assert.equal(chunksOf("boston"), null);
  // a city sits in exactly one group; an area that spans groups loads each of them
  assert.deepEqual(chunksOf("city:boston"), [L.PICK_GROUPS.findIndex((g) => g[2].includes("boston")), FILES.length - 1].sort((a, b) => a - b));
  assert.ok(chunksOf("area:west-coast").length > 2, "West Coast spans several groups");
  assert.ok(chunksOf("area:east-coast").length > 2, "East Coast spans several groups");
});

test("every city, area and state: the chunks give the same cards in the same order as the whole lite file, with and without online widening", () => {
  const nowMs = NOW;
  for (const p of allPlaces) {
    const idx = chunksOf(p);
    const seen = new Set(), merged = [];
    for (const i of idx) for (const e of liteChunks[FILES[i]]) if (!seen.has(e.id)) { seen.add(e.id); merged.push(e); }
    merged.sort(byIdOrder);
    for (const placeOnline of [false, true]) {
      const s = { place: p, placeOnline };
      const want = lite.filter((e) => L.matches(e, s, nowMs));
      const got = merged.filter((e) => L.matches(e, s, nowMs));
      assert.deepEqual(got.map((e) => e.id), want.map((e) => e.id), p + " online=" + placeOnline);
      assert.deepEqual(got, want, p + " online=" + placeOnline + " same rows");
      // the sorted list a teen sees is the same too, ties and all
      assert.deepEqual(L.sortList(got, "best", nowMs, {}).map((e) => e.id), L.sortList(want, "best", nowMs, {}).map((e) => e.id), p + " sorted");
      assert.deepEqual(L.sortList(got, "name", nowMs, {}).map((e) => e.id), L.sortList(want, "name", nowMs, {}).map((e) => e.id), p + " by name");
    }
  }
});

test("no card is lost: every card is in a chunk unless it touches no place at all", () => {
  const inChunk = new Set();
  for (const f of FILES) for (const e of liteChunks[f]) inChunk.add(e.id);
  const placeRegions = new Set(allPlaces.flatMap((p) => L.placeRegions(p) || []));
  const missing = lite.filter((e) => !inChunk.has(e.id));
  for (const e of missing) assert.ok(!(e.regions || []).some((r) => placeRegions.has(r)), e.id + " is in no chunk but touches a place");
  assert.equal(missing.length, 0, "today every card is in at least one chunk");
});

test("the numbers that count every program come out the same from the stats rows as from the lite rows", () => {
  const stats = json("data/entries-stats.json");
  assert.deepEqual(stats.map((e) => e.id), lite.map((e) => e.id));
  assert.deepEqual(L.placeCounts(stats), L.placeCounts(lite));
  const states = [
    {}, { age: "15" }, { age: "13", when: "open" }, { when: "60" }, { season: "summer" }, { paid: ["pay"] }, { types: ["volunteer"] },
    { fields: ["health"] }, { verified: true }, { noPermit: true }, { age: "16", types: ["research"], paid: ["pay"] },
    { place: "city:boston", placeOnline: false }, { place: "city:atlanta", placeOnline: true, age: "14" },
  ];
  for (const st of states) {
    assert.deepEqual(L.facetCounts(stats, st, NOW).hubs, L.facetCounts(lite, st, NOW).hubs, "hub counts " + JSON.stringify(st));
    const a = L.relaxOptions(stats, Object.assign({ place: "city:boston", age: "15", types: ["volunteer"], paid: ["pay"], when: "60", season: "winter" }, st), NOW);
    const b = L.relaxOptions(lite, Object.assign({ place: "city:boston", age: "15", types: ["volunteer"], paid: ["pay"], when: "60", season: "winter" }, st), NOW);
    assert.deepEqual(a, b, "relax options " + JSON.stringify(st));
  }
});

// ---- the page ----
async function poll(cond, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (cond()) return true; await new Promise((r) => setTimeout(r, 40)); }
  return false;
}
const dataPaths = (seen) => [...new Set(seen.map((r) => new URL(r.url).pathname.replace(/^\//, "")).filter((p) => p.startsWith("data/") && !p.endsWith("gaps.json")))].sort();
function snapshot(document) {
  const t = (id) => { const el = document.getElementById(id); return el ? el.textContent.replace(/\s+/g, " ").trim() + (el.hidden ? " [hidden]" : "") : null; };
  return {
    count: t("count"),
    ids: [...document.querySelectorAll("#out article.prog")].map((a) => a.id),
    chips: [...document.querySelectorAll(".chip[data-key]")].map((c) => c.getAttribute("data-key") + ":" + c.getAttribute("data-val") + "=" + c.querySelector(".n").textContent + (c.classList.contains("zero") ? "z" : "")),
    places: [...document.querySelectorAll("#place option")].map((o) => o.value + "|" + o.textContent),
    picks: t("picksList"), placeNote: t("placeNote"), townHelp: t("townHelp"), saved: t("savedN"), sortNote: t("sortNote"),
    empty: (document.querySelector("#out .empty") || { textContent: "" }).textContent.replace(/\s+/g, " ").trim(),
  };
}
const FALL = /\/data\/(lite|detail)\//;
// Load a page twice: as shipped, and with every chunk answering 404 so the page falls back to the whole lite file.
async function both(search, opts = {}) {
  const seenA = [], seenB = [];
  const a = await loadPage("find.html", { search, now: NOW, fetchLog: seenA, ...opts });
  const b = await loadPage("find.html", { search, now: NOW, fetchLog: seenB, fetchFail: FALL, ...opts });
  return { a, b, seenA, seenB, snapA: snapshot(a.document), snapB: snapshot(b.document) };
}

const SAMPLES = [
  ["a Bay Area city", "?at=city:san-francisco"],
  ["Boston", "?at=city:boston"],
  ["a Plains state", "?at=state:nebraska"],
  ["a Bay Area area", "?at=area:bay-area"],
  ["a place that spans groups", "?at=area:east-coast"],
  ["a place with few cards (Detroit)", "?at=city:detroit"],
  ["Boston with age, kind and pay filters", "?at=city:boston&age=15&kind=volunteer&pay=pay"],
  ["Seattle with a date filter and the dates view", "?at=city:seattle&when=60&view=dates"],
  ["Austin sorted by name with a season", "?at=city:austin&sort=name&season=summer"],
  ["Atlanta with a filter that matches nothing", "?at=city:atlanta&age=12&when=closed&kind=research&interest=health&checked=1"],
];
for (const [label, search] of SAMPLES) {
  test("first load, " + label + " (" + search + "): chunks draw what the whole file draws", async () => {
    const { a, b, seenA, seenB, snapA, snapB } = await both(search);
    try {
      const got = dataPaths(seenA), place = new URLSearchParams(search).get("at");
      assert.ok(!got.includes("data/entries-lite.json"), "the whole lite file is not requested: " + got);
      assert.ok(got.includes("data/entries-stats.json") && got.includes("data/lite/shared.json"), got.join());
      assert.equal(got.filter((p) => p.startsWith("data/lite/")).length, a.window.TIG.placeChunks(place).length, got.join());
      assert.deepEqual(dataPaths(seenB).filter((p) => p === "data/entries-lite.json"), ["data/entries-lite.json"], "fallback requests the whole lite file");
      assert.deepEqual(snapA, snapB);
      assert.ok(snapA.places.length > 50 && /\(\d+\)|none yet/.test(snapA.places[5]), "the place list is filled with counts");
      assert.match(snapA.count, /of 2291 programs$/); // 2026-10-12: +77 Plains state cards (2,291 programs)
      assert.deepEqual(a.errors, []);
      assert.deepEqual(b.errors, []);
    } finally { a.window.close(); b.window.close(); }
  });
}

test("the saved place picks the chunks when the address has no parameters, with the same result as the whole file", async () => {
  const storage = { findprefs: { age: "14", place: "city:pittsburgh" } };
  const { a, b, seenA, snapA, snapB } = await both("", { storage });
  try {
    const got = dataPaths(seenA);
    assert.deepEqual(got, ["data/entries-stats.json", "data/lite/northeast.json", "data/lite/shared.json"]);
    assert.deepEqual(snapA, snapB);
  } finally { a.window.close(); b.window.close(); }
});

test("an address with a place but also a search, a card link or an area chip loads the whole file, as before", async () => {
  for (const [search, hash] of [["?at=city:boston&q=garden", ""], ["?where=sf", ""], ["", "#p-nothing"], ["?at=city:nowhere", ""], ["?at=city:boston", "#p-nothing"]]) {
    const seen = [];
    const { window } = await loadPage("find.html", { search, fetchLog: seen, setup: (w) => { if (hash) w.history.replaceState(null, "", w.location.pathname + w.location.search + hash); } });
    const got = dataPaths(seen);
    window.close();
    assert.ok(got.includes("data/entries-lite.json"), search + hash + " loads the whole file: " + got);
    assert.ok(!got.some((p) => p.startsWith("data/lite/")), search + hash + " loads no chunk");
  }
});

test("a failing chunk falls back to the whole lite file and the page still works", async () => {
  const seen = [];
  const { window, document, errors } = await loadPage("find.html", { search: "?at=city:boston", now: NOW, fetchLog: seen, fetchFail: /\/data\/lite\/shared\.json/ });
  const got = dataPaths(seen);
  assert.ok(got.includes("data/entries-lite.json"), got.join());
  assert.match(document.getElementById("count").textContent, /of 2291 programs$/); // 2026-10-12: +77 Plains state cards (2,291 programs)
  assert.ok(document.querySelectorAll("#out article.prog").length > 0);
  assert.deepEqual(errors, []);
  window.close();
});

// ---- changing the page after it loaded ----
function setPlace(window, document, value) {
  const sel = document.getElementById("place");
  sel.value = value;
  sel.dispatchEvent(new window.Event("change", { bubbles: true }));
}
async function reference(search, opts = {}) {
  const r = await loadPage("find.html", { search, now: NOW, fetchFail: FALL, ...opts });
  const snap = snapshot(r.document);
  r.window.close();
  return snap;
}

test("picking another place loads that place's group and draws what a fresh load draws", async () => {
  const seen = [];
  const { window, document } = await loadPage("find.html", { search: "?at=city:boston", now: NOW, fetchLog: seen });
  const before = dataPaths(seen);
  assert.ok(!before.includes("data/lite/pacific-northwest.json"));
  setPlace(window, document, "city:seattle");
  assert.ok(await poll(() => dataPaths(seen).includes("data/lite/pacific-northwest.json")), "the Pacific Northwest group is requested");
  const want = await reference("?at=city:seattle");
  assert.ok(await poll(() => document.getElementById("placeNote").textContent.includes("Seattle")), "the list moved to Seattle");
  const got = snapshot(document);
  // the address bar and prefs follow the pick the same way; compare what is drawn
  assert.deepEqual({ ...got, sortNote: 0 }, { ...want, sortNote: 0 });
  assert.ok(!dataPaths(seen).includes("data/entries-lite.json"), "still no whole lite file");
  window.close();
});

test("a place in a group that is already loaded needs no new request", async () => {
  const seen = [];
  const { window, document } = await loadPage("find.html", { search: "?at=city:boston", now: NOW, fetchLog: seen });
  const n = seen.length;
  setPlace(window, document, "city:philadelphia");
  assert.ok(await poll(() => document.getElementById("placeNote").textContent.includes("Philadelphia")));
  assert.equal(seen.length, n, "no new request");
  const want = await reference("?at=city:philadelphia");
  assert.deepEqual({ ...snapshot(document), sortNote: 0 }, { ...want, sortNote: 0 });
  window.close();
});

test("an area chip, clearing the place, or a search loads the whole lite file and the page matches a whole-file page", async () => {
  // clear all filters (no place left)
  {
    const seen = [];
    const { window, document } = await loadPage("find.html", { search: "?at=city:boston", now: NOW, fetchLog: seen });
    document.getElementById("reset").click();
    assert.ok(await poll(() => dataPaths(seen).includes("data/entries-lite.json")), "the whole file is requested");
    assert.ok(await poll(() => document.querySelector("#count").textContent.startsWith("2291 of"))); // 2026-10-12: +77 Plains state cards (2,291 programs)
    const want = await reference("");
    assert.deepEqual({ ...snapshot(document), sortNote: 0 }, { ...want, sortNote: 0 });
    window.close();
  }
  // an area chip
  {
    const seen = [];
    const { window, document } = await loadPage("find.html", { search: "?at=city:boston", now: NOW, fetchLog: seen });
    document.querySelector('.chip[data-key="hubs"][data-val="sf"]').click();
    assert.ok(await poll(() => dataPaths(seen).includes("data/entries-lite.json")));
    const want = await reference("?where=sf");
    assert.ok(await poll(() => JSON.stringify(snapshot(document).ids) === JSON.stringify(want.ids)), "same cards as ?where=sf");
    assert.deepEqual({ ...snapshot(document), sortNote: 0, saved: 0 }, { ...want, sortNote: 0, saved: 0 });
    window.close();
  }
  // a typed search
  {
    const seen = [];
    const { window, document } = await loadPage("find.html", { search: "?at=city:boston", now: NOW, fetchLog: seen });
    const q = document.getElementById("q");
    q.value = "garden";
    q.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.ok(await poll(() => dataPaths(seen).includes("data/entries-lite.json")), "the whole file is requested");
    assert.ok(await poll(() => dataPaths(seen).includes("data/entries-detail.json")), "the whole detail file is requested");
    const want = await reference("?at=city:boston&q=garden");
    assert.ok(await poll(() => JSON.stringify(snapshot(document).ids) === JSON.stringify(want.ids)));
    assert.equal(snapshot(document).count, want.count);
    window.close();
  }
});

test("a saved card outside the chunks loads the whole file so My list keeps its count", async () => {
  const outside = lite.find((e) => !(e.regions || []).some((r) => r === "virtual" || r === "national" || ["boston", "massachusetts"].includes(r)) && !liteChunks.northeast.some((x) => x.id === e.id));
  const inside = liteChunks.northeast[0];
  const st = { saved: [outside.id, inside.id] };
  const seen = [];
  const { window, document } = await loadPage("find.html", { search: "?at=city:boston", now: NOW, fetchLog: seen, storage: st });
  assert.ok(dataPaths(seen).includes("data/entries-lite.json"), dataPaths(seen).join());
  assert.equal(document.getElementById("savedN").textContent, "2");
  window.close();
});

test("a card link (#p-) to a card outside the loaded chunks opens it after the whole file arrives", async () => {
  const outside = liteChunks.california.find((e) => !liteChunks.northeast.some((x) => x.id === e.id) && !(e.regions || []).some((r) => r === "virtual" || r === "national"));
  const seen = [];
  const { window, document } = await loadPage("find.html", { search: "?at=city:boston", now: NOW, fetchLog: seen });
  window.location.hash = "#p-" + outside.id;
  assert.ok(await poll(() => dataPaths(seen).includes("data/entries-lite.json")), "the whole file is requested");
  assert.ok(await poll(() => !!document.getElementById("p-" + outside.id)), "the card is drawn");
  window.close();
});

// ---- the long text ----
test("the long text for a chunked page comes from the group detail files, not the whole detail file", async () => {
  const seen = [];
  const { window, document } = await loadPage("find.html", { search: "?at=city:boston", now: NOW, fetchLog: seen });
  const first = document.querySelector("#out article.prog");
  first.querySelector("details").open = true;
  first.querySelector("details").dispatchEvent(new window.Event("toggle"));
  assert.ok(await poll(() => dataPaths(seen).some((p) => p.startsWith("data/detail/"))), "a detail chunk is requested");
  const got = dataPaths(seen);
  assert.deepEqual(got.filter((p) => p.startsWith("data/detail/")), ["data/detail/northeast.json", "data/detail/shared.json"]);
  assert.ok(!got.includes("data/entries-detail.json"));
  const id = first.id.slice(2);
  const row = detail.find((e) => e.id === id);
  assert.ok(await poll(() => !first.querySelector("dl").hasAttribute("data-detail")), "the card's long text arrives");
  if (row.who_can_apply) assert.ok(first.querySelector("dl").textContent.includes(row.who_can_apply.slice(0, 30)));
  window.close();
});

test("the idle detail prefetch after the first draw uses the group detail files", async () => {
  const seen = [];
  const { window } = await loadPage("find.html", { search: "?at=state:nebraska", now: NOW, fetchLog: seen });
  assert.ok(await poll(() => dataPaths(seen).some((p) => p.startsWith("data/detail/")), 7000), "prefetch ran");
  assert.deepEqual(dataPaths(seen).filter((p) => p.includes("detail")), ["data/detail/plains-and-mountain.json", "data/detail/shared.json"]);
  window.close();
});

// ---- bytes ----
const gz = (f) => zlib.gzipSync(fs.readFileSync(path.join(ROOT, f)), { level: 9 }).length;
const raw = (f) => fs.statSync(path.join(ROOT, f)).size;

// First-load data (before the 3 second detail prefetch) for three sample places, versus the whole lite file the page loaded before this change.
// Measured 2026-10-12 (raw bytes on disk, gzip level 9). Ceilings are the measured size rounded up to 1000.
const BUDGET = {
  // Before this change every one of these loaded entries-lite.json: 2,101,411 bytes raw, 437,338 gzipped.
  // 2026-10-12: +77 Plains state cards (2,291 programs). The stats file and the shared file grew with the new cards. Raised: a Bay Area city raw 1126000 to 1150000, gzip 186000 to 190000; Boston raw 1017000 to 1041000, gzip 163000 to 167000; a Plains state raw 713000 to 807000, gzip 101000 to 120000.
  "?at=city:san-francisco": { raw: 1150000, gzip: 190000, label: "a Bay Area city" },
  "?at=city:boston": { raw: 1041000, gzip: 167000, label: "Boston" },
  "?at=state:nebraska": { raw: 807000, gzip: 120000, label: "a Plains state" },
};
for (const [search, b] of Object.entries(BUDGET)) {
  test("first-load data bytes for " + b.label + " stay under the pinned budget and far under the whole lite file", async () => {
    const seen = [];
    const { window } = await loadPage("find.html", { search, fetchLog: seen });
    window.close();
    const files = dataPaths(seen);
    const rawN = files.reduce((n, f) => n + raw(f), 0), gzN = files.reduce((n, f) => n + gz(f), 0);
    assert.ok(rawN <= b.raw, search + " raw " + rawN + " over " + b.raw + " (" + files.join() + ")");
    assert.ok(gzN <= b.gzip, search + " gzip " + gzN + " over " + b.gzip);
    assert.ok(gzN < gz("data/entries-lite.json") * 0.5, "less than half of the whole lite file (gzip)");
    assert.ok(rawN < raw("data/entries-lite.json") * 0.7, "well under the whole lite file (raw)");
  });
}
