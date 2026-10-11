// r2-a11y-perf-6: every data/entries-*.json file is fetched by a page script, and the two old unused files are gone.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const scripts = fs.readdirSync(path.join(ROOT, "assets", "js")).filter((f) => f.endsWith(".js"));
const common = read("assets/js/common.js");
const others = scripts.filter((f) => f !== "common.js").map((f) => [f, read("assets/js/" + f)]);

// The argument a page script passes to G.loadEntries, for each file common.js can fetch.
const BRANCH = { "entries-lite": "true", "entries-core": '"core"', "entries-stats": '"stats"', "entries-home": '"home"', "entries-cal": '"cal"', "entries-detail": '"detail"' };

test("every data/entries-*.json file is named in a G.loadEntries branch that a page script reaches", () => {
  const files = fs.readdirSync(path.join(ROOT, "data")).filter((f) => /^entries-.*\.json$/.test(f)).map((f) => f.slice(0, -5));
  assert.ok(files.length >= 6, "found the entries files");
  for (const f of files) {
    assert.ok(common.includes('"data/' + f + '.json"'), f + " is not fetched in common.js");
    const arg = BRANCH[f];
    assert.ok(arg, f + " has no known G.loadEntries argument; add it to BRANCH if a page really reads it");
    const re = new RegExp("loadEntries\\(" + arg.replace(/"/g, '"') + "\\)");
    assert.ok(others.some(([, src]) => re.test(src)), f + " is fetched by common.js but no page script calls loadEntries(" + arg + ")");
  }
});

test("data/entries.json is allowed only because CONTRIBUTING.md documents it as a download, and the About page links it as one", () => {
  assert.match(read("CONTRIBUTING.md"), /`entries\.json` and `entries\.csv` are also the download/);
  assert.match(read("src/about.html"), /href="data\/entries\.json"/, "the About page links the download");
});

test("the card and blurb files are gone and common.js has no card or blurb branch", () => {
  assert.ok(!fs.existsSync(path.join(ROOT, "data", "entries-card.json")));
  assert.ok(!fs.existsSync(path.join(ROOT, "data", "entries-blurb.json")));
  assert.doesNotMatch(common, /lite === "card"|lite === "blurb"|entries-card|entries-blurb/);
  assert.doesNotMatch(read("tools/build_data.py"), /entries-card\.json|entries-blurb\.json/);
});
