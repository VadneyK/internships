// Every built page loads with no console errors or warnings, no unhandled rejections, no window errors,
// and no 404 or 500 answers from the local server (data files, fonts, scripts).
// Run with: node --test tests/r1-tests-3-console-clean.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick, badResponses } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

for (const page of PAGES) {
  test(`${page}: no console problems, rejections or bad requests`, async () => {
    badResponses.length = 0;
    const seen = [];
    const onReject = (reason) => seen.push("node unhandledRejection: " + String((reason && reason.message) || reason));
    process.on("unhandledRejection", onReject);
    let dom;
    try {
      const loaded = await loadPage(page, {
        setup(w) {
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
    } finally {
      process.off("unhandledRejection", onReject);
      if (dom) dom.window.close();
    }
    assert.deepEqual(seen, [], `${page} logged problems`);
    assert.deepEqual([...badResponses], [], `${page} caused 404 or 500 responses`);
  });
}
