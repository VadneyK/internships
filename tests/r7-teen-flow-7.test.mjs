// Ticket r7-teen-flow-7: Programs (find.html) My list view shows one next-step line for saved programs.
// Run with: node --test tests/r7-teen-flow-7.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { tick } from "./dom-helper.mjs";

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

// Same loader as tests/find.dom.test.mjs: real page, real scripts, fetch() served from the repo.
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
  return { window: dom.window, document, errors };
}

test("r7-teen-flow-7: My list shows the next-step line for two saved programs, then hides it when both are unstarred", async () => {
  const { document, errors } = await loadFind();
  const line = document.getElementById("listNext");
  assert.ok(line, "next-step line exists");
  assert.ok(line.hidden, "hidden while My list is off");
  assert.ok(line.classList.contains("noprint"), "line is hidden in print");

  const ids = [...document.querySelectorAll("article.prog .star")].slice(0, 2).map((s) => s.getAttribute("data-id"));
  assert.equal(ids.length, 2, "two cards to star");
  for (const id of ids) document.querySelector('article.prog .star[data-id="' + id + '"]').click();
  assert.equal(document.getElementById("savedN").textContent, "2", "toolbar star count is 2 before My list is on");

  document.getElementById("savedOnly").click();
  await tick(30);
  assert.equal(document.getElementById("savedN").textContent, "2", "toolbar star count unchanged in My list");
  assert.ok(!line.hidden, "line shows in My list with saved programs");
  assert.equal(document.getElementById("listNextN").textContent, "2", "count is 2");
  assert.equal(line.textContent.replace(/\s+/g, " ").trim(),
    "Saved 2. Next: write to one person who works at one of them (Write your message) or see when they open (What opens when).",
    "line text");
  const links = [...line.querySelectorAll("a")];
  assert.deepEqual(links.map((a) => a.getAttribute("href")), ["playbook.html", "calendar.html"], "both links");
  assert.deepEqual(links.map((a) => a.textContent.trim()), ["Write your message", "What opens when"], "link labels");

  for (const id of ids) {
    const star = document.querySelector('article.prog .star[data-id="' + id + '"]');
    assert.ok(star, "saved card still shown before unstar: " + id);
    star.click();
    await tick(30);
  }
  assert.ok(line.hidden, "line hidden once the list is empty");
  assert.equal(document.getElementById("savedN").textContent, "0", "toolbar star count is 0");
  assert.deepEqual(errors, [], "no script errors");
});

test("r7-teen-flow-7: the line is hidden again when My list is switched off", async () => {
  const { document } = await loadFind();
  const line = document.getElementById("listNext");
  const star = document.querySelector("article.prog .star");
  star.click();
  await tick(20);
  document.getElementById("savedOnly").click();
  await tick(30);
  assert.ok(!line.hidden, "shown in My list");
  document.getElementById("savedOnly").click();
  await tick(30);
  assert.ok(line.hidden, "hidden when My list is off");
});
