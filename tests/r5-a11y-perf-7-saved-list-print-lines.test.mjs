// Ticket r5-a11y-perf-7: the Find "Print my list" sheet.
// Each saved program line shows only the parts the program has (no "()" and no empty line), every saved name is
// listed in the data order, and the sheet ends with a "Last checked" date copied from the page footer.
// Run with: node --test tests/r5-a11y-perf-7-saved-list-print-lines.test.mjs
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

// Three saved programs with org, deadline_text and url all filled in on the real data.
const SAVED = ["1001-colors-seasonal-youth-apprenticeship", "accel-middle-college", "acwdb-youth-innovation"];
// The program whose org, deadline_text and url are blanked in memory (through the fetch of data/entries.json).
const BLANK = "accel-middle-college";

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

async function loadFind(onPrint) {
  const port = await server();
  const base = "http://127.0.0.1:" + port + "/";
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(String((e && e.message) || e)));
  vc.on("error", (...a) => errors.push(a.join(" ")));
  const dom = await JSDOM.fromURL(base + "find.html", {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      w.localStorage.setItem("saved", JSON.stringify(SAVED));
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.URL.createObjectURL = () => "blob:test";
      w.URL.revokeObjectURL = () => {};
      // Serve data/entries.json and data/entries-lite.json with one saved program's org, deadline_text and url blanked. Everything else is the real file.
      w.fetch = (u, opts) => {
        const url = new URL(String(u), base);
        const isList = /\/data\/entries(-lite)?\.json$/.test(url.pathname); // the page reads the lite file first
        if (!isList) return globalThis.fetch(url, opts);
        return globalThis.fetch(url, opts).then((r) => r.json()).then((list) => {
          const mod = list.map((e) => (e.id === BLANK ? Object.assign({}, e, { org: "", deadline_text: "", url: "" }) : e));
          return new Response(JSON.stringify(mod), { status: 200, headers: { "Content-Type": "application/json" } });
        });
      };
    },
  });
  const { document } = dom.window;
  await new Promise((r) => (document.readyState === "complete" ? r() : dom.window.addEventListener("load", r)));
  for (let i = 0; i < 80 && /Loading/.test(document.getElementById("count").textContent); i++) await tick(25);
  dom.window.print = () => onPrint(document, dom.window);
  return { window: dom.window, document, errors };
}

test("find: Print my list shows only the parts each saved program has, lists every name in order, and dates the sheet from the footer", async () => {
  const seen = [];
  const { window, document, errors } = await loadFind((doc) => {
    const root = doc.getElementById("printRoot");
    seen.push({
      html: root ? root.innerHTML : "",
      text: root ? root.textContent : "",
      lis: root ? [...root.querySelectorAll("li")].map((li) => ({ text: li.textContent, html: li.innerHTML })) : [],
      names: root ? [...root.querySelectorAll("li > b")].map((b) => b.textContent) : [],
      hasRoot: !!root,
    });
  });

  const footer = document.querySelector(".foot b");
  const checked = footer ? footer.textContent.trim() : "";
  assert.ok(checked.length > 0, "the footer should show a Last checked date");

  document.getElementById("printList").click();

  assert.equal(seen.length, 1, "print should be called once");
  const sheet = seen[0];
  assert.equal(sheet.hasRoot, true, "#printRoot must exist when print is called");

  // no empty parentheses and no empty line
  assert.ok(!sheet.text.includes("()"), "the sheet must not contain ()");
  assert.ok(!/<br>\s*<br>/i.test(sheet.html), "no two line breaks in a row");
  assert.ok(!/<br>\s*<\/li>/i.test(sheet.html), "no line break at the end of a program line");

  // every saved name, in the data order, one line each
  const expectedNames = DATA.filter((e) => SAVED.includes(e.id)).map((e) => e.name);
  assert.deepEqual(sheet.names, expectedNames, "every saved name should be listed in order");
  assert.equal(sheet.lis.length, SAVED.length);

  // the program with blanks shows only its name
  const blankIdx = expectedNames.indexOf(DATA.find((e) => e.id === BLANK).name);
  assert.equal(sheet.lis[blankIdx].text, expectedNames[blankIdx], "a program with no org, deadline or link shows only its name");

  // the other programs keep all their parts
  DATA.filter((e) => SAVED.includes(e.id) && e.id !== BLANK).forEach((e) => {
    const li = sheet.lis[expectedNames.indexOf(e.name)];
    assert.ok(li.text.includes("(" + e.org + ")"), "org shown for " + e.name);
    assert.ok(li.text.includes(e.deadline_text), "deadline shown for " + e.name);
    assert.ok(li.text.includes(e.url), "link shown for " + e.name);
  });

  // the date comes from the footer, not a fixed string
  assert.ok(sheet.text.includes("Last checked " + checked), "the sheet should say Last checked with the footer date");

  // no em dash or en dash on the sheet
  assert.ok(!/[‒-―−]/.test(sheet.text), "the sheet must not contain dash characters");

  window.dispatchEvent(new window.Event("afterprint"));
  assert.equal(document.getElementById("printRoot"), null, "print layer is removed afterwards");
  assert.deepEqual(errors, []);
});
