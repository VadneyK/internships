// r1-accuracy-2: no unsourced "most teens never ask" or "beats every job site" claims.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pages = readdirSync(root).filter((f) => f.endsWith(".html"));

test("built root pages avoid absolute asking claims", () => {
  assert.ok(pages.length > 0);
  for (const p of pages) {
    const html = readFileSync(join(root, p), "utf8");
    for (const bad of ["Most teens never ask", "beats every job site", "gets a yes"]) {
      assert.ok(!html.includes(bad), `${p} contains "${bad}"`);
    }
  }
});
