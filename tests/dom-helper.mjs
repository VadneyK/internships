// Loads a built page (for example "playbook.html") in jsdom with its real scripts, so tests can click and type.
// A tiny static server on 127.0.0.1 serves the repo, so pages get a real origin (localStorage works). No outside network.
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".csv": "text/csv", ".txt": "text/plain" };

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

/* storage values are JSON-encoded; rawStorage values are stored as given (for example theme: "dark") */
export async function loadPage(file, { search = "", storage = {}, rawStorage = {} } = {}) {
  const port = await server();
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(String((e && e.message) || e)));
  vc.on("error", (...a) => errors.push(a.join(" ")));
  const dom = await JSDOM.fromURL("http://127.0.0.1:" + port + "/" + file + search, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, JSON.stringify(v));
      for (const [k, v] of Object.entries(rawStorage)) w.localStorage.setItem(k, v);
      w.fetch = (u, o) => fetch(new URL(String(u), w.location.href), o); // jsdom has no fetch; use Node's, against the local server
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
      w.print = () => { w.__printed = (w.__printed || 0) + 1; };
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.URL.createObjectURL = () => "blob:test";
      w.URL.revokeObjectURL = () => {};
    },
  });
  await new Promise((r) => (dom.window.document.readyState === "complete" ? r() : dom.window.addEventListener("load", r)));
  await new Promise((r) => setTimeout(r, 80)); // let async init (fetch of data/entries.json) finish
  return { dom, window: dom.window, document: dom.window.document, errors };
}

export function type(window, el, value) {
  el.value = value;
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
}
export const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
