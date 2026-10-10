// Run with: node --test tests/r1-perf-scale-3.test.mjs
// Programs page: cards are drawn from data/entries-lite.json; the long text comes from data/entries-detail.json
// only when it is needed (a card opened, a search typed, a #p- link, a print, or an idle prefetch after 3 seconds).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { loadPage, type, tick } from "./dom-helper.mjs";

const require = createRequire(import.meta.url);
const L = require("../assets/js/lib.js");
const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const FULL = JSON.parse(read("data/entries.json"));
const LITE = JSON.parse(read("data/entries-lite.json"));
const gz = (p) => zlib.gzipSync(fs.readFileSync(new URL("../" + p, import.meta.url)), { level: 9 }).length;
const PAGE = 60;

async function until(fn, ms = 4000, what = "condition") {
  const t0 = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error("timed out waiting for " + what);
    await tick(20);
  }
}

/* Loads find.html with a fetch that logs every data request. Options:
   hold: detail responses wait until release() is called
   failDetail: the first detail request fails
   connection: sets navigator.connection */
async function loadFind({ search = "", hold = false, failDetail = false, connection } = {}) {
  const log = [];
  const scrolled = [];
  const ctl = { release: null, failures: failDetail ? 1 : 0 };
  const gate = hold ? new Promise((r) => { ctl.release = r; }) : null;
  const t0 = Date.now();
  const page = await loadPage("find.html", {
    search,
    setup(w) {
      let real;
      Object.defineProperty(w, "fetch", {
        configurable: true,
        get() {
          return (u, o) => {
            const url = String(u);
            if (/data\/entries/.test(url)) log.push({ url: url.replace(/^.*(data\/[^?]*).*$/, "$1"), t: Date.now() - t0 });
            if (/entries-detail/.test(url)) {
              if (ctl.failures > 0) { ctl.failures -= 1; return (gate || Promise.resolve()).then(() => Promise.reject(new Error("offline"))); }
              if (gate) return gate.then(() => real(u, o));
            }
            return real(u, o);
          };
        },
        set(v) { real = v; },
      });
      let scroll = function () {};
      Object.defineProperty(w.HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        get() { return function () { scrolled.push(this.id); return scroll.apply(this, arguments); }; },
        set(v) { scroll = v; },
      });
      if (connection) Object.defineProperty(w.navigator, "connection", { configurable: true, value: connection });
    },
  });
  return { ...page, log, scrolled, ctl, t0, detailCount: () => log.filter((r) => /entries-detail/.test(r.url)).length };
}

const cardsIn = (document) => [...document.querySelectorAll("#out article.prog")];
const whoMap = (article) => {
  const m = {};
  article.querySelectorAll("dl > div").forEach((d) => { m[d.querySelector("dt").textContent] = d.querySelector("dd").textContent; });
  return m;
};

test("(1) load: lite file once, no full or detail file in the first 500 ms, bytes fall by about 46 percent", async () => {
  const p = await loadFind();
  await until(() => cardsIn(p.document).length === PAGE, 4000, "first 60 cards");
  const wait = 500 - (Date.now() - p.t0);
  if (wait > 0) await tick(wait + 20);
  const early = p.log.filter((r) => r.t <= 500).map((r) => r.url);
  assert.deepEqual(p.log.map((r) => r.url), ["data/entries-lite.json"], "only the lite file is requested");
  assert.ok(!early.includes("data/entries.json") && !early.includes("data/entries-detail.json"));
  const before = gz("data/entries.json"), after = gz("data/entries-lite.json");
  const cut = 1 - after / before;
  assert.ok(cut > 0.4 && cut < 0.6, "gzipped bytes before interaction fall by " + Math.round(cut * 100) + " percent (" + before + " to " + after + ")");
  assert.equal(p.document.querySelectorAll("#out [data-detail='wait']").length, PAGE, "every closed card holds the short loading note");
  assert.deepEqual(p.errors, []);
  p.window.close();
});

test("(2) a word found only in the notes: no match at first, then the program once the detail file arrives (one request)", async () => {
  const now = Date.now();
  let pick = null;
  for (const e of FULL) {
    for (const w of ((e.notes || "") + " " + (e.who_can_apply || "")).toLowerCase().match(/[a-z]{7,}/g) || []) {
      const inLite = LITE.filter((x) => L.matches(x, { q: w }, now)).length;
      const inFull = FULL.filter((x) => L.matches(x, { q: w }, now));
      if (inLite === 0 && inFull.length >= 1 && inFull.length <= 5) { pick = { w, ids: inFull.map((x) => x.id) }; break; }
    }
    if (pick) break;
  }
  assert.ok(pick, "the data has a word that only a notes or who-can-apply field holds");
  const p = await loadFind({ hold: true });
  await until(() => cardsIn(p.document).length === PAGE, 4000, "cards");
  assert.equal(p.detailCount(), 0);
  type(p.window, p.document.getElementById("q"), pick.w);
  await tick(450);
  assert.equal(p.detailCount(), 1, "typing starts one detail request");
  assert.ok(!p.document.getElementById("p-" + pick.ids[0]), "no match while the detail file is on its way");
  assert.match(p.document.getElementById("count").textContent, /^0 of /);
  assert.ok(p.document.querySelector("#out [data-detail-wait]"), "the empty list says the text is still loading");
  p.ctl.release();
  await until(() => p.document.getElementById("p-" + pick.ids[0]), 4000, "the program to appear");
  const ids = new Set(cardsIn(p.document).map((a) => a.id.slice(2)));
  assert.deepEqual([...ids].sort(), pick.ids.slice().sort());
  assert.match(p.document.getElementById("count").textContent, new RegExp("^" + pick.ids.length + " of "));
  assert.equal(p.document.querySelector("#out [data-detail-wait]"), null);
  type(p.window, p.document.getElementById("q"), pick.w + " ");
  await tick(300);
  assert.equal(p.detailCount(), 1, "detail was requested exactly once");
  p.window.close();
});

test("(3) opening a card: one detail request, a loading note, then the same text as entries.json; focus and open card stay", async () => {
  const p = await loadFind({ hold: true });
  await until(() => cardsIn(p.document).length === PAGE, 4000, "cards");
  assert.equal(p.detailCount(), 0);
  const first = cardsIn(p.document)[0], det = first.querySelector("details"), sum = det.querySelector("summary");
  sum.focus();
  det.open = true; // fires toggle, the same as a click on the summary
  await until(() => p.detailCount() === 1, 2000, "the detail request");
  assert.match(det.textContent, /Loading details/);
  assert.equal(det.querySelector("dl").getAttribute("aria-busy"), null);
  p.ctl.release();
  await until(() => !/Loading details/.test(det.textContent), 4000, "the detail text");
  const entry = FULL.find((e) => e.id === first.id.slice(2));
  const got = whoMap(first);
  if (entry.who_can_apply) assert.equal(got["Who can apply"], entry.who_can_apply);
  if (entry.how_to_apply) assert.equal(got["How to apply"], entry.how_to_apply);
  if (entry.notes) assert.equal(got["Good to know"], entry.notes);
  assert.ok(entry.who_can_apply || entry.how_to_apply || entry.notes, "the first card has long text to compare");
  assert.equal(first, cardsIn(p.document)[0], "the card element was filled in place, not rebuilt");
  assert.ok(det.open, "the card stays open");
  assert.equal(p.document.activeElement, sum, "focus stays on the summary");
  assert.equal(p.detailCount(), 1);
  assert.deepEqual(p.errors, []);
  p.window.close();
});

test("(3b) a failed detail load shows a short message, and opening a card again tries again", async () => {
  const p = await loadFind({ failDetail: true });
  await until(() => cardsIn(p.document).length === PAGE, 4000, "cards");
  const first = cardsIn(p.document)[0], det = first.querySelector("details");
  det.open = true;
  await until(() => /Could not load these details/.test(det.textContent), 4000, "the failure note");
  det.open = false;
  await tick(20);
  det.open = true;
  await until(() => !/Could not load|Loading details/.test(det.textContent), 4000, "the retry to fill the card");
  assert.equal(p.detailCount(), 2);
  p.window.close();
});

test("(4) a #p- link to a card past the first 60 scrolls to it and opens it with the full text", async () => {
  const ranked = L.sortList(LITE, "best", Date.now());
  const target = ranked[100];
  const p = await loadFind({ search: "#p-" + target.id });
  const art = await until(() => p.document.getElementById("p-" + target.id), 4000, "the card");
  assert.ok(p.scrolled.includes("p-" + target.id), "scrolled to the card");
  assert.ok(art.querySelector("details").open, "card is open");
  const entry = FULL.find((e) => e.id === target.id);
  await until(() => !/Loading details/.test(art.textContent), 4000, "the detail text");
  const got = whoMap(art);
  if (entry.who_can_apply) assert.equal(got["Who can apply"], entry.who_can_apply);
  if (entry.how_to_apply) assert.equal(got["How to apply"], entry.how_to_apply);
  if (entry.notes) assert.equal(got["Good to know"], entry.notes);
  assert.equal(p.detailCount(), 1, "the link starts one detail request");
  p.window.close();
});

test("(5) with saveData on, no detail request happens until a trigger; without it, an idle prefetch starts after 3 seconds", async () => {
  const [sd, slow, free] = await Promise.all([
    loadFind({ connection: { saveData: true, effectiveType: "4g" } }),
    loadFind({ connection: { saveData: false, effectiveType: "3g" } }),
    loadFind(),
  ]);
  await until(() => cardsIn(free.document).length === PAGE, 4000, "cards");
  await tick(2200);
  assert.equal(free.detailCount(), 0, "no prefetch before 3 seconds");
  await until(() => free.detailCount() === 1, 3000, "the idle prefetch");
  const at = free.log.find((r) => /detail/.test(r.url)).t;
  assert.ok(at >= 3000, "prefetch started at " + at + " ms, not before 3000");
  await until(() => !/Loading details/.test(free.document.querySelector("#out article.prog details").textContent), 4000, "prefetch to fill the cards");
  assert.equal(sd.detailCount(), 0, "saveData: no request");
  assert.equal(slow.detailCount(), 0, "3g: no request");
  /* a trigger still works with saveData on */
  const det = cardsIn(sd.document)[0].querySelector("details");
  det.open = true;
  await until(() => sd.detailCount() === 1, 2000, "the detail request after a card is opened");
  await until(() => !/Loading details/.test(det.textContent), 4000, "the detail text");
  for (const p of [sd, slow, free]) p.window.close();
});

test("(5b) a search in the address, and a print, each start one detail request", async () => {
  const q = await loadFind({ search: "?q=garden" });
  await until(() => cardsIn(q.document).length > 0, 4000, "cards");
  await until(() => q.detailCount() === 1, 2000, "request from ?q=");
  const pr = await loadFind();
  await until(() => cardsIn(pr.document).length === PAGE, 4000, "cards");
  assert.equal(pr.detailCount(), 0);
  pr.window.dispatchEvent(new pr.window.Event("beforeprint"));
  pr.window.dispatchEvent(new pr.window.Event("beforeprint"));
  await until(() => pr.detailCount() === 1, 2000, "request from beforeprint");
  await tick(100);
  assert.equal(pr.detailCount(), 1);
  pr.window.dispatchEvent(new pr.window.Event("afterprint"));
  q.window.close();
  pr.window.close();
});

test("(6) after the detail file loads, each of the first 60 cards is the same HTML as one built from entries.json", async () => {
  const p = await loadFind();
  await until(() => cardsIn(p.document).length === PAGE, 4000, "cards");
  cardsIn(p.document)[0].querySelector("details").open = true;
  await until(() => p.document.querySelectorAll("#out [data-detail]").length === 0, 4000, "all cards filled");
  const tmp = p.document.createElement("div");
  const arts = cardsIn(p.document);
  assert.equal(arts.length, PAGE);
  for (const a of arts) {
    const entry = FULL.find((e) => e.id === a.id.slice(2));
    tmp.innerHTML = p.window.TIG.cardHtml(entry);
    p.window.TIG.markNewTabLinks(tmp); // the page adds "opens in a new tab" to every card it draws
    const want = tmp.firstElementChild;
    const have = a.cloneNode(true);
    have.querySelector("details").removeAttribute("open");
    assert.equal(have.outerHTML, want.outerHTML, entry.id);
  }
  p.window.close();
});
