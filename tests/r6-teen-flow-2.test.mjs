// Programs page related chips carry the chosen age and area to Calendar and Permit.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".csv": "text/csv", ".txt": "text/plain" };
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const p = path.join(ROOT, rel);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end("no"); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  res.end(fs.readFileSync(p));
});
const port = await new Promise((r) => srv.listen(0, "127.0.0.1", () => { srv.unref(); r(srv.address().port); }));

async function load(search = "") {
  const vc = new VirtualConsole();
  const dom = await JSDOM.fromURL("http://127.0.0.1:" + port + "/find.html" + search, {
    runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      w.print = () => {}; w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.fetch = (u, o) => globalThis.fetch(new URL(u, "http://127.0.0.1:" + port + "/"), o);
    },
  });
  const d = dom.window.document;
  await new Promise((r) => (d.readyState === "complete" ? r() : dom.window.addEventListener("load", r)));
  for (let i = 0; i < 80 && /Loading/.test(d.getElementById("count").textContent); i++) await tick(25);
  return { window: dom.window, document: d };
}
const hrefs = (d) => [...d.querySelectorAll("#relatedLinks a")].map((a) => a.getAttribute("href"));
const texts = (d) => [...d.querySelectorAll("#relatedLinks a")].map((a) => a.textContent.trim());
const TEXTS = ["What opens when", "Do I need a work permit?", "Ages 12 to 14"];

test("related chips: plain with no filters", async () => {
  const { document } = await load();
  assert.deepEqual(hrefs(document), ["calendar.html", "permit.html", "younger.html"]);
  assert.deepEqual(texts(document), TEXTS);
});

test("related chips: age 15 and a place are carried, then cleared", async () => {
  const { window, document } = await load("?at=city:davis&age=15");
  const place = document.getElementById("place").value;
  assert.ok(place, "place should be set from the URL");
  assert.deepEqual(hrefs(document), ["calendar.html?at=" + encodeURIComponent(place) + "&age=15", "permit.html?age=15", "younger.html"]);
  assert.deepEqual(texts(document), TEXTS);
  document.getElementById("age").value = "";
  document.getElementById("age").dispatchEvent(new window.Event("change", { bubbles: true }));
  await tick(50);
  assert.deepEqual(hrefs(document), ["calendar.html?at=" + encodeURIComponent(place), "permit.html", "younger.html"]);
});

test("related chips: ages 12 and 13 do not add age to permit", async () => {
  for (const a of ["12", "13"]) {
    const { document } = await load("?age=" + a);
    assert.deepEqual(hrefs(document), ["calendar.html?age=" + a, "permit.html", "younger.html"]);
  }
});
