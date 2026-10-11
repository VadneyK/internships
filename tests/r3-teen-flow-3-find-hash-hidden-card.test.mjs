// A shared #p-<id> link must never be a dead end: hidden cards are revealed, unknown ids get a note.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".csv": "text/csv", ".txt": "text/plain" };
let sp;
function server() {
  if (!sp) sp = new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
      const p = path.join(ROOT, rel);
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
      res.end(fs.readFileSync(p));
    });
    s.listen(0, "127.0.0.1", () => { s.unref(); resolve(s.address().port); });
  });
  return sp;
}
async function load(search, storage = {}) {
  const port = await server();
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(String((e && e.message) || e)));
  const dom = await JSDOM.fromURL("http://127.0.0.1:" + port + "/find.html" + search, {
    runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, JSON.stringify(v));
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
      w.print = () => {}; w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.fetch = (u, o) => globalThis.fetch(new URL(u, "http://127.0.0.1:" + port + "/"), o);
    },
  });
  const { document } = dom.window;
  await new Promise((r) => (document.readyState === "complete" ? r() : dom.window.addEventListener("load", r)));
  for (let i = 0; i < 80 && /Loading/.test(document.getElementById("count").textContent); i++) await tick(25);
  await tick(100);
  return { window: dom.window, document, errors };
}
const toast = (d) => (d.getElementById("toast") || d.querySelector(".toast") || { textContent: "" }).textContent;
const MSG = "Filters cleared to show this program";
const id = DATA[0].id;

test("visible card: opened and focused, no toast", async () => {
  const { document, errors } = await load("#p-" + id);
  const el = document.getElementById("p-" + id);
  assert.ok(el); assert.equal(el.querySelector("details").open, true);
  assert.equal(document.activeElement, el);
  assert.ok(!toast(document).includes(MSG));
  assert.deepEqual(errors, []);
});

test("hidden by a filter: filters clear, card drawn, toast said", async () => {
  const { document, errors } = await load("?q=zzzznomatchzzzz#p-" + id);
  const el = document.getElementById("p-" + id);
  assert.ok(el, "card should be drawn");
  assert.equal(document.getElementById("q").value, "");
  assert.equal(el.querySelector("details").open, true);
  assert.equal(document.activeElement, el);
  assert.equal(toast(document), MSG);
  assert.deepEqual(errors, []);
});

test("hidden by My list only: saved-only clears", async () => {
  const { window, document, errors } = await load("", { saved: [DATA[1].id] });
  document.getElementById("savedOnly").click();
  assert.equal(document.querySelectorAll("article.prog").length, 1);
  window.location.hash = "#p-" + id;
  await tick(100);
  assert.equal(document.getElementById("savedOnly").getAttribute("aria-pressed"), "false");
  const el = document.getElementById("p-" + id);
  assert.ok(el);
  assert.equal(document.activeElement, el);
  assert.equal(toast(document), MSG);
  assert.deepEqual(errors, []);
});

test("unknown id: visible note with a link to the full list, no error", async () => {
  const { document, errors } = await load("#p-not-a-real-program");
  const note = document.getElementById("hashNote");
  assert.ok(note);
  assert.match(note.textContent, /no longer on the list/);
  assert.ok(note.querySelector('a[href="find.html"]'));
  assert.ok(document.querySelectorAll("article.prog").length > 0);
  assert.deepEqual(errors, []);
});
