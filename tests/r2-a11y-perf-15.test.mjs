// r2-a11y-perf-15: the Programs page says on paper when the printed list is cut off.
// A print-only line (#printCut) under the cards reads "Showing 60 of N programs. ..." while more matches
// exist behind Show more. It is empty when the whole list fits on one page. The screen never shows it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { type, tick } from "./dom-helper.mjs";

const require = createRequire(import.meta.url);
const L = require("../assets/js/lib.js");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));
const PAGE_SIZE = 60;
const SEARCH_DEBOUNCE = 220;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".csv": "text/csv", ".txt": "text/plain" };
const CUT_RE = /^Showing (\d+) of (\d+) programs\. Open the page and press Show more for the rest\.$/;

let serverPromise;
function server() {
  if (!serverPromise) {
    serverPromise = new Promise((resolve) => {
      const s = http.createServer((req, res) => {
        const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
        const p = path.join(ROOT, rel);
        if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
        res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
        res.end(fs.readFileSync(p));
      });
      s.listen(0, "127.0.0.1", () => { s.unref(); resolve(s.address().port); });
    });
  }
  return serverPromise;
}

// Loads find.html with its real scripts. fetch() reads the real data files from the local server.
async function loadFind() {
  const port = await server();
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(String((e && e.message) || e)));
  vc.on("error", (...a) => errors.push(a.join(" ")));
  const dom = await JSDOM.fromURL("http://127.0.0.1:" + port + "/find.html", {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
      w.print = () => {};
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.URL.createObjectURL = () => "blob:test";
      w.URL.revokeObjectURL = () => {};
      w.fetch = (u, opts) => globalThis.fetch(new URL(u, "http://127.0.0.1:" + port + "/"), opts);
    },
  });
  const { document } = dom.window;
  await new Promise((r) => (document.readyState === "complete" ? r() : dom.window.addEventListener("load", r)));
  for (let i = 0; i < 80 && /Loading/.test(document.getElementById("count").textContent); i++) await tick(25);
  return { dom, window: dom.window, document, errors };
}

// "259 of 259 programs" -> 259
function countShown(doc) {
  const m = /^(\d+) of (\d+) programs$/.exec(doc.getElementById("count").textContent);
  assert.ok(m, "unexpected count text: " + doc.getElementById("count").textContent);
  return Number(m[1]);
}
const cutText = (doc) => doc.getElementById("printCut").textContent;

test("find.html: the print note element exists, is outside the Show more pager, and is print-only", async () => {
  const { document } = await loadFind();
  const cut = document.getElementById("printCut");
  assert.ok(cut, "no #printCut element");
  assert.ok(cut.classList.contains("printonly"), "#printCut should have class printonly");
  assert.equal(cut.closest(".pager"), null, "#printCut must not be inside .pager");
  assert.equal(cut.closest(".noprint"), null, "#printCut must not be inside .noprint");
});

test("find.html: with no filters the note states 60 of N, where N is the count in #count", async () => {
  const { document, errors } = await loadFind();
  const n = countShown(document);
  assert.ok(n > PAGE_SIZE * 2, "needs more than 120 programs with no filters (got " + n + ")");
  const m = CUT_RE.exec(cutText(document));
  assert.ok(m, "unexpected note text: " + cutText(document));
  assert.equal(Number(m[1]), PAGE_SIZE);
  assert.equal(Number(m[2]), n);
  assert.deepEqual(errors, []);
});

test("find.html: Show more moves the note to 120 of N", async () => {
  const { document } = await loadFind();
  const n = countShown(document);
  document.getElementById("more").click();
  await tick(25);
  const m = CUT_RE.exec(cutText(document));
  assert.ok(m, "unexpected note text after Show more: " + cutText(document));
  assert.equal(Number(m[1]), PAGE_SIZE * 2);
  assert.equal(Number(m[2]), n);
});

test("find.html: when the list fits on one page the note is empty", async () => {
  const { window, document } = await loadFind();
  type(window, document.getElementById("q"), "zxqvjwk");
  await tick(SEARCH_DEBOUNCE);
  assert.equal(countShown(document), 0, "nonsense search should match nothing");
  assert.equal(cutText(document), "");
});

test("find.html: a search with fewer than 60 matches leaves the note empty, and 60 or more fills it", async () => {
  const { window, document } = await loadFind();
  type(window, document.getElementById("q"), "hospital");
  await tick(SEARCH_DEBOUNCE);
  const n = countShown(document);
  const expected = DATA.filter((e) => L.matches(e, { q: "hospital" }, Date.now())).length;
  assert.equal(n, expected, "count should match the data");
  if (n <= PAGE_SIZE) assert.equal(cutText(document), "", "fewer than 60 matches: note should be empty");
  else assert.match(cutText(document), CUT_RE);
});

// Style checks on the stylesheet text: print-only means hidden on screen and shown inside @media print.
const css = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
function depthAt(text, idx) {
  let d = 0;
  for (let i = 0; i < idx; i++) { if (text[i] === "{") d++; else if (text[i] === "}") d--; }
  return d;
}
function enclosingMedia(text, idx) {
  const before = text.slice(0, idx);
  const at = before.lastIndexOf("@media");
  return at < 0 ? "" : before.slice(at, before.indexOf("{", at) + 1).replace(/\s+/g, " ");
}

test("style.css: .printonly is display none on screen (top level) and display block inside @media print", () => {
  const screen = css.indexOf(".printonly { display: none; }");
  assert.ok(screen > -1, "no on-screen .printonly { display: none; } rule");
  assert.equal(depthAt(css, screen), 0, "the on-screen rule must sit outside any @media block");
  const printRule = css.indexOf(".printonly { display: block !important; }");
  assert.ok(printRule > -1, "no print .printonly { display: block !important; } rule");
  assert.equal(enclosingMedia(css, printRule), "@media print {", "the print rule must sit inside @media print");
});
