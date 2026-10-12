import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARE = "Many permits need a parent to sign, depending on your age and state. Show a parent this answer:";

test("r3-accuracy-3: permit share line hedges the parent signature (source and built file)", () => {
  for (const f of ["src/permit.html", "permit.html"]) {
    const html = fs.readFileSync(path.join(ROOT, f), "utf8");
    const m = html.match(/<p class="share-parent[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    assert.ok(m, f + ": share-parent row exists");
    assert.match(m[1], new RegExp(SHARE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), f + ": new wording present");
    assert.doesNotMatch(html, /A parent signs the permit/, f + ": old unconditional sentence is gone");
  }
});
