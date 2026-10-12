// r3-accuracy-1: the Home "one thing to know" heading must not say people beat
// job sites. The bars show referrals were 1.6% of applications and 17.1% of
// hires, and job sites were 49% of applications and 24.6% of hires. The text
// about adult data must be hedged, and the bar aria-label must not change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const H2 = '<h2>In one company\'s data, referrals led to <span class="orange">far more hires</span></h2>';
const HEDGE = "This is adult data, so treat it as a hint, not proof, for teens.";
const FIRST_MOVE = "So a good first move is a short message to one adult who already knows you.";
const BARS = 'aria-label="Referrals: 1.6 percent of applications and 17.1 percent of hires. Job sites: 49 percent of applications and 24.6 percent of hires."';

for (const file of ["src/index.html", "index.html"]) {
  test(`r3-accuracy-1: ${file} heading no longer says people beat job sites`, () => {
    const html = read(file);
    assert.ok(html.includes(H2), "new h2 is present");
    assert.ok(!/People beat/i.test(html), "old heading is gone");
  });

  test(`r3-accuracy-1: ${file} hedges the adult-data sentence and fixes the first move line`, () => {
    const html = read(file);
    assert.ok(html.includes(HEDGE), "hedged sentence is present");
    assert.ok(html.includes(FIRST_MOVE), "first move sentence is present");
    assert.ok(!html.includes("The idea carries over"), "old carry-over sentence is gone");
    assert.ok(!html.includes("your first move is not a website"), "old first move sentence is gone");
  });

  test(`r3-accuracy-1: ${file} keeps the bars aria-label unchanged`, () => {
    assert.ok(read(file).includes(BARS), "bars aria-label matches the data");
  });
}
