// ux9-pills: short pickers are round pills through one .fpill class; long sentence answers stay rectangles.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../assets/css/style.css", import.meta.url), "utf8");
const page = (n) => readFileSync(new URL("../" + n + ".html", import.meta.url), "utf8");
const fieldOf = (html, id) => {
  const m = new RegExp('<div class="([^"]*)">(?:<span class="step"[^>]*>\\d</span>)?<label for="' + id + '"').exec(html);
  return m && m[1];
};

test(".fpill rule is round, content-width, one line", () => {
  const m = /\.fpill \.tp \.tile \{([^}]*)\}/.exec(css);
  assert.ok(m, "rule exists");
  assert.match(m[1], /flex: 0 0 auto/);
  assert.match(m[1], /min-width: 3\.4rem/);
  assert.match(m[1], /border-radius: 999px/);
  assert.match(m[1], /min-height: 2\.75rem/);
  assert.doesNotMatch(m[1], /flex: 0 0 3\.4rem/);
});

test("short pickers carry fpill, long answers do not", () => {
  for (const [p, ids] of [["jobs", ["jAge"]], ["permit", ["pAge"]], ["calendar", ["cAge"]], ["interview", ["aAge"]], ["languages", ["lLang", "lState"]]])
    for (const id of ids) assert.match(fieldOf(page(p), id) || "", /\bfpill\b/, p + " " + id);
  assert.doesNotMatch(fieldOf(page("permit"), "pKind") || "", /fpill/);
  assert.doesNotMatch(fieldOf(page("interview"), "aSchool") || "", /fpill/);
});

test("permit age beats the Home big-digit tile rule", () => {
  assert.match(css, /\.fpill #pAge \+ \.tp \.tile \{[^}]*font-weight: 700/);
});

test("Home and Programs keep their rules", () => {
  assert.match(css, /#pAge \+ \.tp \.tile \{ flex: 0 0 3\.4rem/);
  assert.match(css, /#age \+ \.tp \.tile \{ min-width: 3\.1rem/);
  assert.ok(!/fpill/.test(page("index")));
});
