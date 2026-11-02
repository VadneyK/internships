// The Southern California views of the Find page, the ones the Ignition SoCal QR code opens.
// tests/a11y-axe.dom.test.mjs scans every page with its default view. This scans the same page with
// the SoCal hub chosen, so the place chips, cards and notes it draws are scanned too.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { loadPage, waitFor } from "./dom-helper.mjs";

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

async function scan(window) {
  if (!window.axe) window.eval(axeSource);
  const res = await window.axe.run(window.document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return res.violations;
}

const describe = (v) => v.id + ": " + v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ") + " (" + v.nodes.length + " nodes)";

for (const search of ["?where=socal", "?where=socal&when=open"]) {
  test("axe: find.html" + search + " draws cards and has no WCAG A/AA violations", async () => {
    const { window, document } = await loadPage("find.html", { search });
    await waitFor(() => /^\d+ of \d+ programs$/.test(document.getElementById("count").textContent));
    const shown = Number(/^(\d+)/.exec(document.getElementById("count").textContent)[1]);
    assert.ok(shown > 0, "the SoCal view shows programs");
    const found = [...(await scan(window))].map(describe);
    assert.deepEqual(found, [], "find.html" + search + " has axe violations");
  });
}
