// docs/MAINTAINING.md must list the real hubs and the bulk fact-check workflow.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const md = fs.readFileSync(new URL("../docs/MAINTAINING.md", import.meta.url), "utf8");
const readme = fs.readFileSync(new URL("../docs/research/README.md", import.meta.url), "utf8");

test("MAINTAINING lists every hub id and label from HUBS", () => {
  assert.ok(L.HUBS.length >= 16);
  for (const h of L.HUBS) {
    assert.ok(md.includes("| `" + h[0] + "` | " + h[1] + " |"), "missing hub row: " + h[0] + " " + h[1]);
  }
});

test("MAINTAINING describes the bulk pass and the automation", () => {
  for (const s of ["## Bulk fact-check pass", "docs/VERIFYING.md", "report-NN.md", "DOWNGRADED to snippet-only", "FIXED (what changed)", "REMOVED (why)",
    "ADDING_A_REGION.md", "Not checked", "link-report", "refresh-full", "150 most urgent", "CodeQL", "verified_on"]) {
    assert.ok(md.includes(s), "missing: " + s);
  }
  assert.ok(!md.includes("`oak` (Oakland"), "old region list is gone");
});

test("docs have no em or en dash and the research README is dated", () => {
  assert.ok(!/[\u2013\u2014]/.test(md + readme));
  assert.ok(readme.includes("At the end of the first pass on Oct 7, 2026"));
  assert.ok(readme.includes("The current count is in `data/meta.json`."));
  assert.ok(!/238 programs remain\b/.test(readme));
});
