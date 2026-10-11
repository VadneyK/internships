// Ticket r3-teen-flow-13: the Programs page says in plain words how to save a card, and glosses
// "work-based learning" and "career technical education" in the "Don't see your town?" box.
// Run with: node --test tests/r3-teen-flow-13-find-save-hint.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".csv": "text/csv", ".txt": "text/plain" };
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

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
  for (let i = 0; i < 120 && !document.querySelector("article.prog"); i++) await tick(25);
  return { document, errors };
}

const normal = (s) => s.replace(/\s+/g, " ").trim();

test("r3-teen-flow-13: the lede area says to tap the star and that the list stays on this device", async () => {
  const { document, errors } = await loadFind();
  const lede = document.querySelector("section .lede");
  assert.ok(lede, "the lede exists");
  const area = normal(lede.parentElement.textContent);
  assert.ok(/tap the star on (its|a) card/i.test(area), "says to tap the star on a card: " + area);
  assert.ok(area.includes("stays on this device"), "says the list stays on this device");
  assert.ok(area.includes("My list"), "names My list, the word the page uses for saved cards");
  assert.deepEqual(errors, []);
});

test("r3-teen-flow-13: the 'Don't see your town?' box glosses work-based learning and career technical education", async () => {
  const { document } = await loadFind();
  const box = [...document.querySelectorAll(".callout")].find((c) => c.querySelector("h3") && /see your town/i.test(c.querySelector("h3").textContent));
  assert.ok(box, "the box exists");
  const text = normal(box.textContent);
  assert.ok(text.includes("“work-based learning” list (programs that place students in real workplaces)"), "work-based learning gloss: " + text);
  assert.ok(text.includes("“career technical education” list (school classes that teach a job skill)"), "career technical education gloss: " + text);
});

test("r3-teen-flow-13: a rendered program card has the star control the lede names", async () => {
  const { document } = await loadFind();
  const card = document.querySelector("article.prog");
  assert.ok(card, "at least one card rendered");
  const star = card.querySelector("button.star");
  assert.ok(star, "the card has a star button");
  assert.equal(star.textContent.trim(), "★", "the star glyph");
  assert.equal(star.getAttribute("title"), "Save to my list");
  assert.match(star.getAttribute("aria-label"), /^Save .+ to my list$/);
  assert.equal(star.getAttribute("aria-pressed"), "false");
});

test("r3-teen-flow-13: the new wording has no em dash or en dash and the built page matches the template", () => {
  const src = fs.readFileSync(path.join(ROOT, "src/find.html"), "utf8");
  const built = fs.readFileSync(path.join(ROOT, "find.html"), "utf8");
  for (const [name, text] of [["src", src], ["built", built]]) {
    assert.ok(!/[\u2013\u2014]/.test(text), name + " find.html has an en or em dash");
  }
  assert.ok(built.includes("tap the star on its card"), "built page has the save sentence");
  assert.ok(built.includes("(programs that place students in real workplaces)"), "built page has the work-based gloss");
  assert.ok(built.includes("(school classes that teach a job skill)"), "built page has the CTE gloss");
});
