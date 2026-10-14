// Loads a built page (for example "playbook.html") in jsdom with its real scripts, so tests can click and type.
// A tiny static server on 127.0.0.1 serves the repo, so pages get a real origin (localStorage works). No outside network.
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".csv": "text/csv", ".txt": "text/plain" };

// Requests the local server answered with 404 or 500, as "STATUS /path". Tests may read and clear it.
export const badResponses = [];

let serverPromise;
function server() {
  if (!serverPromise) {
    serverPromise = new Promise((resolve) => {
      const s = http.createServer((req, res) => {
        const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "").replace(/^internships\//, "") || "index.html"; // the live site lives under /internships/; the 404 page links there
        const p = path.join(ROOT, rel);
        if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { badResponses.push("404 " + req.url); res.writeHead(404, { Connection: "close" }); res.end("not found"); return; }
        try {
          const body = fs.readFileSync(p);
          res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream", Connection: "close" });
          res.end(body);
        } catch (e) { badResponses.push("500 " + req.url); res.writeHead(500, { Connection: "close" }); res.end("error"); }
      });
      s.listen(0, "127.0.0.1", () => { s.unref(); resolve(s.address().port); });
    });
  }
  return serverPromise;
}

/* storage values are JSON-encoded; rawStorage values are stored as given (for example theme: "dark")
   setup(window): optional, runs first in beforeParse, before any page script (for example to make localStorage throw)
   fetchLog: optional array; every fetch the page makes is pushed to it as { url, init }
   fetchFail: optional RegExp; a fetch whose URL matches it answers 404 at once (the request is still logged)
   lazy: optional; interview.html is otherwise nudged to load permits.json, as a teen using the hours checker would
   now: optional millisecond timestamp; new Date() and Date.now() start there and keep ticking, while new Date(args), Date.UTC and Date.parse are unchanged */
export async function loadPage(file, { search = "", storage = {}, rawStorage = {}, setup, now, fetchLog, lazy, fetchFail } = {}) {
  const port = await server();
  const errors = [];
  const inflight = { n: 0 }; // fetches the page started and has not finished
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(String((e && e.message) || e)));
  vc.on("error", (...a) => errors.push(a.join(" ")));
  const dom = await JSDOM.fromURL("http://127.0.0.1:" + port + "/" + file + search, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      if (typeof setup === "function") setup(w);
      if (typeof now === "number") {
        const RealDate = w.Date;
        const t0 = RealDate.now();
        const clock = () => now + (RealDate.now() - t0);
        class FakeDate extends RealDate {
          constructor(...a) { if (a.length === 0) super(clock()); else super(...a); }
          static now() { return clock(); }
        }
        w.Date = FakeDate;
      }
      for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, JSON.stringify(v));
      for (const [k, v] of Object.entries(rawStorage)) w.localStorage.setItem(k, v);
      w.fetch = (u, o) => { const url = new URL(String(u), w.location.href); if (fetchLog) fetchLog.push({ url: url.href, init: o }); inflight.n++; const pr = fetchFail && fetchFail.test(url.href) ? Promise.resolve(new Response("not found", { status: 404 })) : fetch(url, o); pr.then(() => { inflight.n--; }, () => { inflight.n--; }); return pr; }; // jsdom has no fetch; use Node's, against the local server
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
      w.print = () => { w.__printed = (w.__printed || 0) + 1; };
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.URL.createObjectURL = () => "blob:test";
      w.URL.revokeObjectURL = () => {};
    },
  });
  await new Promise((r) => (dom.window.document.readyState === "complete" ? r() : dom.window.addEventListener("load", r)));
  // interview.html loads the state rules (permits.json) only when the hours checker is used. Most tests drive the checker, so wake it
  // here unless the test passes lazy: true to look at the page before any use.
  if (!lazy && file === "interview.html") {
    const sec = dom.window.document.getElementById("availability");
    if (sec) sec.dispatchEvent(new dom.window.Event("focusin", { bubbles: true }));
  }
  await new Promise((r) => setTimeout(r, 80)); // let async init (fetch of data/entries.json) finish
  // Wait (up to 3 s) until the fetches the page started on load have finished, then a short beat for the page to use them
  for (let i = 0; i < 60 && inflight.n > 0; i++) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 30));
  // Some dropdowns get their options from a data file (2026-10-12: home picker flow adds the home Where select, marked data-places): wait (up to 2 s) until none that should have choices is still empty
  for (let i = 0; i < 40 && [...dom.window.document.querySelectorAll("select[data-tiles], select[data-places]")].some((x) => x.options.length < 2); i++) await new Promise((r) => setTimeout(r, 50));
  // On a slow machine the data may still be loading: wait (up to 5 s) until the Where list of a page that has one is filled
  for (let i = 0; i < 100 && dom.window.document.getElementById("place") && dom.window.document.getElementById("place").options.length < 2; i++) await new Promise((r) => setTimeout(r, 50));
  return { dom, window: dom.window, document: dom.window.document, errors };
}

export function type(window, el, value) {
  el.value = value;
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
}
export const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
// Polls cond() every step ms; true as soon as it is truthy, false after timeout ms. Use it instead of a fixed sleep when the next assertion checks the same condition.
export async function waitFor(cond, { timeout = 10000, step = 10 } = {}) {
  const end = Date.now() + timeout;
  for (;;) {
    let ok = false;
    try { ok = !!cond(); } catch (e) { ok = false; }
    if (ok) return true;
    if (Date.now() >= end) return false;
    await new Promise((r) => setTimeout(r, step));
  }
}
