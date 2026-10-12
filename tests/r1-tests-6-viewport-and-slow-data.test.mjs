// Every built root page loads at widths 360, 768 and 1280 with every data fetch delayed by 50 ms.
// Checks: no console.error or console.warn, no unhandled rejection, no duplicate ids after data renders,
// and the first visible status or result text is not empty.
// dom-helper.mjs has no width option, so setup() (which runs before page scripts) sets window.innerWidth
// and a width-aware matchMedia. dom-helper installs its own w.fetch after setup(), so setup() defines
// fetch as an accessor that wraps whatever gets assigned with a 50 ms delay.
// Run with: node --test tests/r1-tests-6-viewport-and-slow-data.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && f !== "404.html").sort();
const WIDTHS = [360, 768, 1280];
const DELAY = 50;

function mq(query, width) {
  const m = /\((min|max)-width:\s*(\d+(?:\.\d+)?)px\)/.exec(query);
  let matches = false;
  if (m) matches = m[1] === "min" ? width >= +m[2] : width <= +m[2];
  return { matches, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
}

function isHidden(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    if (n.hidden || n.getAttribute("aria-hidden") === "true" || (n.style && n.style.display === "none")) return true;
  }
  return false;
}

for (const page of PAGES) {
  for (const width of WIDTHS) {
    test(`${page} at ${width}px with 50 ms data delay: clean, unique ids, text present`, async () => {
      const seen = [];
      const onReject = (reason) => seen.push("node unhandledRejection: " + String((reason && reason.message) || reason));
      process.on("unhandledRejection", onReject);
      let dom;
      try {
        const loaded = await loadPage(page, {
          setup(w) {
            Object.defineProperty(w, "innerWidth", { value: width, configurable: true, writable: true });
            Object.defineProperty(w, "outerWidth", { value: width, configurable: true, writable: true });
            w.matchMedia = (q) => mq(String(q), width);
            let inner;
            Object.defineProperty(w, "fetch", {
              configurable: true,
              get() { return inner; },
              set(f) { inner = (...a) => new Promise((r) => setTimeout(r, DELAY)).then(() => f(...a)); },
            });
            for (const level of ["error", "warn"]) {
              const orig = w.console[level] && w.console[level].bind(w.console);
              w.console[level] = (...a) => { seen.push(`console.${level}: ` + a.map(String).join(" ")); if (orig) orig(...a); };
            }
            w.addEventListener("error", (e) => seen.push("window error: " + (e.message || e.type)));
            w.addEventListener("unhandledrejection", (e) => seen.push("unhandledrejection: " + String((e.reason && e.reason.message) || e.reason)));
          },
        });
        dom = loaded.dom;
        await tick(200);
        seen.push(...loaded.errors.map((e) => "jsdom: " + e));
        const doc = loaded.document;
        assert.equal(loaded.window.innerWidth, width);
        const ids = [...doc.querySelectorAll("[id]")].map((e) => e.id);
        const dups = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
        assert.deepEqual(dups, [], `${page} at ${width}: duplicate ids`);
        const live = [...doc.querySelectorAll("[role=status], [aria-live]")].filter((e) => !isHidden(e) && e.textContent.trim());
        const first = live[0] || doc.querySelector("main h1") || doc.querySelector("h1");
        assert.ok(first && first.textContent.trim().length > 0, `${page} at ${width}: no visible status or heading text`);
      } finally {
        process.off("unhandledRejection", onReject);
        if (dom) dom.window.close();
      }
      assert.deepEqual(seen, [], `${page} at ${width} logged problems`);
    });
  }
}
