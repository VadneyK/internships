// Every built root page x three network states: all ok, every data/ fetch 404, every data/ fetch invalid JSON.
// Asserts: no uncaught error, no console.error, no unhandled rejection, main keeps an h1, and a page that
// fetched data on first load shows some visible status text in main when the data failed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = new URL("../", import.meta.url);
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && f !== "404.html").sort(); // 404.html uses absolute /internships/ asset paths, so it cannot load from the test server root; it has no data fetch

// Known failures: "page|state" -> reason. Each needs a fix ticket; remove the entry when fixed.
const ALLOW = {
  "index.html|404": "Home picker and soon list stay empty with no sentence when data/entries-home.json fails (matchStatus and soonStatus are blank). File a fix ticket.",
  "index.html|badjson": "Same as 404: no visible sentence when entries-home.json is not valid JSON. File a fix ticket.",
  "insights.html|404": "Insights has no status region at all; charts stay empty with no sentence when entries-stats.json fails. File a fix ticket.",
  "insights.html|badjson": "Same as 404: no sentence when entries-stats.json is not valid JSON. File a fix ticket.",
};

// Replaces fetch (dom-helper sets its own later; this setter keeps ours in front) for /data/ requests only.
function stub(mode, dataLog) {
  return (w) => {
    let inner = null;
    const f = (u, o) => {
      const url = new URL(String(u), w.location.href);
      if (/\/data\//.test(url.pathname)) {
        dataLog.push(url.pathname);
        if (mode === "404") return Promise.resolve(new Response("not found", { status: 404 }));
        if (mode === "badjson") return Promise.resolve(new Response("{ not json <<", { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      return inner(u, o);
    };
    Object.defineProperty(w, "fetch", { get: () => f, set: (v) => { inner = v; }, configurable: true });
  };
}

const rejections = [];
process.on("unhandledRejection", (r) => rejections.push(String((r && r.message) || r)));

const CONCURRENCY = 8;
async function check(page, state) {
  const dataLog = [];
  const { document, errors, window } = await loadPage(page, { setup: stub(state, dataLog) });
  await tick(150);
  await new Promise((r) => setImmediate(r));
  const problems = [];
  if (errors.length) problems.push("errors: " + errors.join(" | "));
  const main = document.querySelector("main") || document.body;
  if (!main.querySelector("h1")) problems.push("no h1 in main");
  if (state !== "ok" && dataLog.length) {
    const shown = [...main.querySelectorAll('[role="status"], [aria-live], .status, [id$="Status"], [id*="status" i]')]
      .some((e) => e.textContent.trim() && !e.hidden && !e.closest("[hidden]"));
    if (!shown) problems.push("data was fetched (" + [...new Set(dataLog)].join(", ") + ") but no visible status text in main");
  }
  window.close();
  return problems;
}

test("every root page x ok, 404 and invalid JSON data", async (t) => {
  const cases = [];
  for (const state of ["ok", "404", "badjson"]) for (const page of PAGES) cases.push({ page, state });
  const results = new Array(cases.length);
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < cases.length) {
      const i = next++;
      results[i] = await check(cases[i].page, cases[i].state).catch((e) => ["threw: " + e.message]);
    }
  }));
  const failures = [];
  cases.forEach((c, i) => {
    const key = c.page + "|" + c.state;
    const p = results[i];
    if (ALLOW[key]) { if (!p.length) failures.push(key + " is allow-listed but now passes, remove it from ALLOW"); return; }
    if (p.length) failures.push(key + ": " + p.join("; "));
  });
  if (rejections.length) failures.push("unhandled rejections (any page): " + rejections.join(" | "));
  assert.deepEqual(failures, []);
  assert.ok(PAGES.length >= 20, "expected about 22 root pages, found " + PAGES.length);
});
