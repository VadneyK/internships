// The lite program file: same programs as data/entries.json, without the long text fields.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const DROPPED = ["notes", "sources_fetched", "how_to_apply", "who_can_apply"];
const full = JSON.parse(read("data/entries.json"));
const lite = JSON.parse(read("data/entries-lite.json"));

test("lite file has the same ids in the same order as entries.json", () => {
  const files = fs.readdirSync(new URL("../data/programs/", import.meta.url)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  assert.equal(full.length, files.length);
  assert.equal(lite.length, full.length);
  assert.deepEqual(lite.map((e) => e.id), full.map((e) => e.id));
});

test("lite file is under 60 percent of the size of entries.json", () => {
  const ratio = Buffer.byteLength(read("data/entries-lite.json")) / Buffer.byteLength(read("data/entries.json"));
  assert.ok(ratio < 0.6, "lite is " + Math.round(ratio * 100) + " percent of entries.json");
});

test("lite file has none of the dropped keys and keeps every other key", () => {
  lite.forEach((e, i) => {
    DROPPED.forEach((k) => assert.ok(!(k in e), e.id + " still has " + k));
    Object.keys(full[i]).filter((k) => !DROPPED.includes(k)).forEach((k) => assert.deepEqual(e[k], full[i][k], e.id + "." + k));
  });
});

test("home, calendar, insights and younger scripts never read the dropped keys", () => {
  for (const f of ["home", "calendar", "insights", "younger"]) {
    const src = read("assets/js/" + f + ".js");
    DROPPED.forEach((k) => assert.ok(!src.includes(k), f + ".js mentions " + k));
    if (f === "younger") assert.match(src, /G\.loadEntries\("core"\)/, f + ".js should load the core file");
    else if (f === "calendar" || f === "insights") assert.match(src, /G\.loadEntries\("card"\)/, f + ".js should load the card file");
    else {
      /* home: the card file first, the lite file only when the picker is used */
      assert.match(src, /G\.loadEntries\("card"\)/, f + ".js should load the card file first");
      assert.match(src, /G\.loadEntries\(true\)/, f + ".js should load the lite file second");
    }
  }
});

test("find.js loads the lite file first, then the detail file for the long text", () => {
  const find = read("assets/js/find.js");
  assert.match(find, /G\.loadEntries\(true\)/);
  assert.match(find, /G\.loadEntries\("detail"\)/);
  assert.doesNotMatch(find, /G\.loadEntries\(\)/);
  assert.match(read("assets/js/common.js"), /data\/entries\.json/);
  assert.match(read("assets/js/common.js"), /data\/entries-lite\.json/);
  assert.match(read("assets/js/common.js"), /data\/entries-detail\.json/);
});
