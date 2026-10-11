// Hostile or broken URL parameters on every page whose script reads location.search, URLSearchParams or location.hash.
// The page list is derived by scanning assets/js and the built pages, so a new page that reads the URL is covered automatically.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const READS_URL = /location\.(search|hash)|URLSearchParams/;

// Pages that cannot take a parameter, skipped by name with a reason. Empty on purpose.
const SKIP = {};

const scripts = fs.readdirSync(path.join(ROOT, "assets/js")).filter((f) => f.endsWith(".js") && READS_URL.test(fs.readFileSync(path.join(ROOT, "assets/js", f), "utf8")));
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && !SKIP[f]).filter((f) => {
  const html = fs.readFileSync(path.join(ROOT, f), "utf8");
  return scripts.some((s) => html.includes("assets/js/" + s));
}).sort();

const long = "x".repeat(5000);
const QUERIES = {
  "age=abc": "?age=abc",
  "age=-5": "?age=-5",
  "age=1e3": "?age=1e3",
  "state=__proto__": "?state=__proto__",
  "state=constructor": "?state=constructor",
  "q=img onerror": "?q=" + encodeURIComponent("<img src=x onerror=1>"),
  "raw img in many keys": "?q=<img src=x onerror=1>&state=<svg onload=1>&at=<script>1</script>&lang=<iframe src=x>&when=<img src=x>&m=<svg>&ride=<img src=x>",
  "5000 character q": "?q=" + long,
  "5000 character state": "?state=" + long,
  "5000 character age": "?age=" + long,
  "5000 character at and lang": "?at=" + long + "&lang=" + long,
  "repeated key": "?age=14&age=abc&age=-5&state=__proto__&state=constructor",
  "invalid percent escape": "?age=%E0%A4%A&state=%E0%A4%A&q=%E0%A4%A&at=%",
  "empty values": "?age=&state=&q=&at=&lang=&when=&m=",
};
const HASHES = {
  "lone hash": "#",
  "junk hash": "#%E0%A4%A<img src=x onerror=1>",
  "p- junk hash": "#p-__proto__",
  "hash with query": "?age=abc#p-<svg onload=1>",
};

const MARKUP = "img, script, iframe, svg";
const BAD_TEXT = /undefined|\bNaN\b|\[object/;
const counts = (d) => [...d.querySelectorAll("main " + MARKUP.split(", ").join(", main "))].reduce((o, e) => ((o[e.localName] = (o[e.localName] || 0) + 1), o), {});

test("the list of pages that read URL parameters is not empty", () => {
  assert.ok(scripts.length > 0, "no script reads location.search, URLSearchParams or location.hash");
  assert.ok(pages.length > 0, "no page loads a script that reads the URL");
});

for (const file of pages) {
  test(file + " survives hostile URL parameters and hashes", async () => {
    const clean = await loadPage(file);
    const base = counts(clean.document);
    const baseText = clean.document.querySelector("main").textContent;
    assert.ok(clean.document.querySelector("main h1"), file + " clean load has no main h1");
    const cases = { ...QUERIES, ...Object.fromEntries(Object.entries(HASHES).map(([k, v]) => ["hash: " + k, v])) };
    for (const [name, search] of Object.entries(cases)) {
      const p = await loadPage(file, { search });
      const label = file + " [" + name + "]";
      const main = p.document.querySelector("main");
      assert.deepEqual(p.errors, [], label + " threw: " + p.errors.join(" | "));
      assert.ok(p.document.querySelector("main h1"), label + " lost its h1");
      assert.deepEqual(counts(p.document), base, label + " added or removed img, script, iframe or svg in main");
      const bad = main.textContent.match(BAD_TEXT);
      if (!BAD_TEXT.test(baseText)) assert.equal(bad, null, label + " shows " + (bad && bad[0]));
      assert.equal(main.querySelectorAll("[onerror], [onload]").length, 0, label + " has an inline handler from the URL");
      p.window.close();
    }
    clean.window.close();
  });
}
