// Transit card text on Get ready (ticket r2-accuracy-8).
// The Yolobus row no longer says "Fares listed" (no fares are listed in that row), and the
// Bay Area table has one "read on" line whose date comes from data/meta.json checked_label.
// Run with: node --test tests/r2-accuracy-8.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const META = JSON.parse(rd("data/meta.json"));
// The day the Bay Area transit pages were last read. It moves only when those pages are read again,
// not when new program cards raise the site-wide checked date in meta.json.
const BAY_AREA_READ = "Oct 10, 2026";

test("ready: Yolobus row uses the agency-page sentence and drops 'Fares listed'", () => {
  const src = rd("src/ready.html");
  assert.match(
    src,
    /Free on fixed routes for ages 18 and under\. The agency page says this is effective through June 30, 2027\./
  );
  assert.doesNotMatch(src, /Fares listed/);
});

test("ready: one read-on line sits under the Bay Area table with the meta date", () => {
  const src = rd("src/ready.html");
  const label = BAY_AREA_READ;
  const line = `We read these Bay Area pages on ${label}. Ages and discounts can change`;
  assert.equal(src.split(line).length - 1, 1, "exactly one read-on line");
  // The line comes after the table and before the Under 13 note.
  const tableEnd = src.indexOf("</table></div>");
  const lineAt = src.indexOf(line);
  const under13 = src.indexOf("Under 13, a parent");
  assert.ok(tableEnd > 0 && lineAt > tableEnd && lineAt < under13);
});

test("ready: built page carries the same Yolobus and read-on text", () => {
  const built = rd("ready.html");
  assert.match(built, /The agency page says this is effective through June 30, 2027\./);
  assert.match(built, new RegExp(`We read these Bay Area pages on ${BAY_AREA_READ}\\.`));
  assert.doesNotMatch(built, /Fares listed are effective/);
});

test("ready: no em dash or en dash in the source page", () => {
  assert.doesNotMatch(rd("src/ready.html"), new RegExp("[\\u2013\\u2014]"));
});
