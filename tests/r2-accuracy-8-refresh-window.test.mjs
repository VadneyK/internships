// r2-accuracy-8: the About page and README name the same refresh window as tools/freshness.py (--days default).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

test("freshness.py --days default is parsed and is the number the About page and README use", () => {
  const src = read("tools/freshness.py");
  const m = src.match(/add_argument\(\s*"--days"\s*,\s*type=int\s*,\s*default=(\d+)\s*\)/);
  assert.ok(m, "could not find the --days default in tools/freshness.py");
  const days = m[1];
  const phrase = `${days} days`;
  for (const f of ["about.html", "README.md"]) {
    assert.ok(read(f).includes(phrase), `${f} must say "${phrase}"`);
    assert.ok(!/four months/i.test(read(f)), `${f} must not say "four months"`);
  }
});

test("src/about.html names the same refresh window as the bot", () => {
  const src = read("tools/freshness.py");
  const days = src.match(/"--days"[^)]*default=(\d+)/)[1];
  assert.ok(read("src/about.html").includes(`re-checked in ${days} days`));
  assert.ok(!/four months/i.test(read("src/about.html")));
});
