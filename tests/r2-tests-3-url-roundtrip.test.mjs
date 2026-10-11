// Ticket r2-tests-3: share-link round trip. A state a teen can reach, written to the address bar and opened fresh,
// must restore the same controls and the same cards. Covers Programs (find.html), Permit and Calendar.
// A failure prints the state and the URL. Seeded PRNG, so a failure repeats.
// Run with: node --test tests/r2-tests-3-url-roundtrip.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEED = 20261010;

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
function subset(r, arr, max) {
  const out = [];
  for (const x of arr) if (out.length < max && r() < 0.35) out.push(x);
  return out;
}
const pressed = (el) => el.getAttribute("aria-pressed") === "true";
const show = (o) => JSON.stringify(o);

// Run fn over items, a few at a time (each item loads a page in jsdom).
async function pool(items, size, fn) {
  let i = 0;
  const workers = Array.from({ length: size }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k], k); }
  });
  await Promise.all(workers);
}

/* ---------------- Programs ---------------- */
const FIND_KEYS = ["q", "where", "at", "age", "when", "season", "pay", "kind", "interest", "checked", "nopermit", "view", "sort"];

function chipVals(document, id) {
  return [...document.querySelectorAll("#" + id + " .chip")].map((b) => b.getAttribute("data-val"));
}
function ids(document) {
  const out = document.getElementById("out"), dates = document.getElementById("dates");
  if (!dates.hidden) return [...dates.querySelectorAll("[data-jump]")].map((a) => a.getAttribute("data-jump")).slice(0, 30);
  return [...out.querySelectorAll("article.prog")].map((a) => a.id.slice(2)).slice(0, 30);
}
// Wait until the list stops changing (a search also waits for the full text file).
async function settle(document) {
  let last = null, same = 0;
  for (let i = 0; i < 60 && same < 3; i++) {
    await tick(100);
    const now = document.getElementById("count").textContent + "|" + ids(document).join(",");
    if (now === last) same++; else { same = 0; last = now; }
  }
}
function snapshot(document) {
  const g = (id) => document.getElementById(id);
  const chips = {};
  for (const id of ["hubChips", "paidChips", "typeChips", "fieldChips"]) chips[id] = [...document.querySelectorAll("#" + id + " .chip")].map((b) => b.getAttribute("data-val") + ":" + pressed(b));
  return {
    q: g("q").value, age: g("age").value, when: g("when").value, season: g("season").value, sort: g("sort").value, place: g("place").value,
    chips, verified: pressed(g("onlyVerified")), noPermit: pressed(g("noPermit")), cards: pressed(g("viewCards")), dates: pressed(g("viewDates")),
    ids: ids(document),
  };
}

test("programs: 40 random states survive the address bar", { timeout: 600000 }, async () => {
  const r = prng(SEED);
  const first = await loadPage("find.html");
  const d0 = first.document;
  const opts = (id) => [...d0.getElementById(id).options].map((o) => o.value).filter(Boolean);
  const AGES = opts("age"), WHENS = opts("when"), SEASONS = opts("season"), SORTS = opts("sort");
  const PLACES = opts("place"), HUBS = chipVals(d0, "hubChips"), PAY = chipVals(d0, "paidChips"), KIND = chipVals(d0, "typeChips"), INT = chipVals(d0, "fieldChips");
  first.window.close();
  assert.deepEqual(AGES, ["12", "13", "14", "15", "16", "17", "18"]);
  assert.ok(PLACES.length > 5 && HUBS.length > 3 && PAY.length && KIND.length && INT.length, "controls should be filled");
  const WORDS = ["hospital", "coding", "animals", "art", "camp", "zzzqq", "library", "science"];

  for (let n = 0; n < 40; n++) {
    const want = { q: "", age: "", when: "", season: "", sort: "best", place: "", hubs: [], pay: [], kind: [], interest: [], checked: false, nopermit: false, dates: false };
    if (r() < 0.4) want.q = pick(r, WORDS);
    if (r() < 0.7) want.age = pick(r, AGES);
    if (r() < 0.5) want.when = pick(r, WHENS);
    if (r() < 0.5) want.season = pick(r, SEASONS);
    if (r() < 0.5) want.sort = pick(r, SORTS);
    if (r() < 0.35) want.place = pick(r, PLACES); else if (r() < 0.5) want.hubs = subset(r, HUBS, 3);
    want.pay = subset(r, PAY, 3); want.kind = subset(r, KIND, 3); want.interest = subset(r, INT, 3);
    want.checked = r() < 0.3; want.nopermit = r() < 0.3; want.dates = r() < 0.25;
    const label = "state " + n + " " + show(want);

    const p1 = await loadPage("find.html");
    try {
      const { window: w, document: d } = p1;
      const g = (id) => d.getElementById(id);
      if (want.q) { type(w, g("q"), want.q); await tick(300); }
      for (const id of ["age", "when", "season", "sort"]) if (want[id] && want[id] !== "best") { g(id).value = want[id]; g(id).dispatchEvent(new w.Event("change", { bubbles: true })); await tick(10); }
      if (want.place) { g("place").value = want.place; g("place").dispatchEvent(new w.Event("change", { bubbles: true })); await tick(10); }
      const click = (grp, v) => d.querySelector("#" + grp + ' .chip[data-val="' + v + '"]').click();
      want.hubs.forEach((v) => click("hubChips", v));
      want.pay.forEach((v) => click("paidChips", v));
      want.kind.forEach((v) => click("typeChips", v));
      want.interest.forEach((v) => click("fieldChips", v));
      if (want.checked) g("onlyVerified").click();
      if (want.nopermit) g("noPermit").click();
      if (want.dates) g("viewDates").click();
      await settle(d);
      const search = w.location.search;
      const before = snapshot(d);

      // The URL is minimal and uses the documented names and separators.
      const params = new w.URLSearchParams(search);
      const expect = new Map();
      if (want.q) expect.set("q", want.q);
      if (want.hubs.length) expect.set("where", want.hubs.join(","));
      if (want.place) expect.set("at", want.place);
      if (want.age) expect.set("age", want.age);
      if (want.when) expect.set("when", want.when);
      if (want.season) expect.set("season", want.season);
      if (want.pay.length) expect.set("pay", want.pay.join(","));
      if (want.kind.length) expect.set("kind", want.kind.join(","));
      if (want.interest.length) expect.set("interest", want.interest.join(","));
      if (want.checked) expect.set("checked", "1");
      if (want.nopermit) expect.set("nopermit", "1");
      if (want.dates) expect.set("view", "dates");
      if (want.sort !== "best") expect.set("sort", want.sort);
      assert.deepEqual(Object.fromEntries(params), Object.fromEntries(expect), label + " URL " + search);
      for (const [k, v] of params) { assert.ok(FIND_KEYS.includes(k), label + " unknown key " + k + " in " + search); assert.notEqual(v, "", label + " empty value for " + k + " in " + search); }
      assert.ok(params.get("sort") !== "best", label + " sort=best written: " + search);
      assert.ok(params.get("view") !== "cards", label + " view=cards written: " + search);

      // Fresh load, nothing stored.
      const p2 = await loadPage("find.html", { search });
      try {
        await settle(p2.document);
        const after = snapshot(p2.document);
        assert.deepEqual(after, before, label + " URL " + search);
        assert.equal(p2.window.location.search, search, label + " reload rewrote the URL: " + search + " -> " + p2.window.location.search);
      } finally { p2.window.close(); }
    } finally { p1.window.close(); }
  }
});

/* ---------------- Permit ---------------- */
test("permit: every state x age x kind reloads to the same answer", { timeout: 900000 }, async () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "permits.json"), "utf8"));
  const states = Object.keys(data.states);
  const kinds = data.kinds.map((k) => k[0]);
  const ages = ["12", "13", "14", "15", "16", "17", "18"];
  assert.ok(states.length >= 17 && kinds.length >= 8);

  const answer = (d) => { const h = d.getElementById("pOut").querySelector("h2"); return h ? h.textContent : d.getElementById("pOut").textContent.trim(); };
  const sel = (d) => ["pState", "pAge", "pKind"].map((id) => d.getElementById(id).value);

  // One live page per state: drive the three selects, read the URL and the answer.
  const combos = [];
  await pool(states, 4, async (st) => {
    const p = await loadPage("permit.html");
    try {
      const { window: w, document: d } = p;
      for (let i = 0; i < 100 && d.getElementById("pKind").options.length < 2; i++) await tick(50);
      const set = (id, v) => { d.getElementById(id).value = v; d.getElementById(id).dispatchEvent(new w.Event("change", { bubbles: true })); };
      for (const age of ages) for (const kind of kinds) {
        set("pState", st); set("pAge", age); set("pKind", kind);
        const search = w.location.search;
        const expect = "?state=" + st + "&age=" + age + "&kind=" + kind;
        assert.equal(search, expect, "permit URL for " + show({ st, age, kind }));
        combos.push({ st, age, kind, search, head: answer(d) });
      }
    } finally { p.window.close(); }
  });
  // Partial states: only some selects chosen never write an empty key.
  const part = await loadPage("permit.html");
  try {
    const d = part.document;
    for (let i = 0; i < 100 && d.getElementById("pKind").options.length < 2; i++) await tick(50);
    d.getElementById("pAge").value = "15"; d.getElementById("pAge").dispatchEvent(new part.window.Event("change", { bubbles: true }));
    assert.equal(part.window.location.search, "?age=15");
  } finally { part.window.close(); }

  await pool(combos, 8, async (c) => {
    const p = await loadPage("permit.html", { search: c.search });
    try {
      for (let i = 0; i < 100 && p.document.getElementById("pKind").options.length < 2; i++) await tick(50);
      await tick(10);
      assert.deepEqual(sel(p.document), [c.st, c.age, c.kind], "permit selects " + show(c) + " URL " + c.search);
      assert.equal(answer(p.document), c.head, "permit headline " + show(c) + " URL " + c.search);
      assert.equal(p.window.location.search, c.search, "permit reload rewrote URL " + c.search);
    } finally { p.window.close(); }
  });
});

/* ---------------- Calendar ---------------- */
test("calendar: every month, with and without at and age, reloads to the same page", { timeout: 600000 }, async () => {
  const probe = await loadPage("calendar.html");
  for (let i = 0; i < 100 && probe.document.getElementById("cPlace").options.length < 2; i++) await tick(50);
  const placeOpts = [...probe.document.getElementById("cPlace").options].map((o) => o.value).filter(Boolean);
  probe.window.close();
  assert.ok(placeOpts.length > 5);
  const at = placeOpts.find((v) => v === "city:oakland") || placeOpts[0];
  const age = "15";

  const view = (d) => ({
    place: d.getElementById("cPlace").value, age: d.getElementById("cAge").value,
    month: [...d.querySelectorAll("#months .chip")].map((b) => b.getAttribute("data-m") + ":" + pressed(b) + ":" + b.getAttribute("aria-label")),
    count: d.getElementById("cCount").textContent,
    close: [...d.querySelectorAll("#cClose li h3")].map((h) => h.textContent), open: [...d.querySelectorAll("#cOpen li h3")].map((h) => h.textContent),
  });
  const variants = [{}, { at }, { age }, { at, age }];
  const jobs = [];
  for (let m = 1; m <= 12; m++) for (const v of variants) jobs.push({ m, ...v });

  await pool(jobs, 4, async (j) => {
    const label = "calendar " + show(j);
    const p = await loadPage("calendar.html");
    let search, before;
    try {
      const { window: w, document: d } = p;
      for (let i = 0; i < 100 && !d.querySelector("#months .chip"); i++) await tick(50);
      d.querySelector('#months .chip[data-m="' + j.m + '"]').click();
      for (const [id, v] of [["cPlace", j.at], ["cAge", j.age]]) if (v) { d.getElementById(id).value = v; d.getElementById(id).dispatchEvent(new w.Event("change", { bubbles: true })); }
      search = w.location.search; before = view(d);
      const expect = new w.URLSearchParams(); expect.set("m", String(j.m)); if (j.at) expect.set("at", j.at); if (j.age) expect.set("age", j.age);
      assert.equal(search, "?" + expect.toString(), label + " URL " + search);
      assert.deepEqual(Object.keys(Object.fromEntries(new w.URLSearchParams(search))), ["m", ...(j.at ? ["at"] : []), ...(j.age ? ["age"] : [])], label);
    } finally { p.window.close(); }
    const p2 = await loadPage("calendar.html", { search });
    try {
      for (let i = 0; i < 100 && !p2.document.querySelector("#months .chip"); i++) await tick(50);
      assert.deepEqual(view(p2.document), before, label + " URL " + search);
      assert.equal(p2.window.location.search, search, label + " reload rewrote URL " + search);
    } finally { p2.window.close(); }
  });
});
