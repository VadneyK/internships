// Ticket r3-a11y-perf-4: names in other languages carry a lang attribute, and official page links carry hreflang.
// Run with: node --test tests/r3-a11y-perf-4.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/languages.json"), "utf8"));
const labels = new Map(data.languages);

async function ready(file, opts) {
  const p = await loadPage(file, opts);
  await tick(120);
  return p;
}

test("languages: every language option except the first has a lang equal to its value", async () => {
  const { document, errors } = await ready("languages.html");
  assert.deepEqual(errors, []);
  const opts = [...document.getElementById("lLang").options];
  assert.equal(opts[0].value, "");
  assert.equal(opts[0].hasAttribute("lang"), false);
  assert.equal(opts.length, data.languages.length + 1);
  for (const o of opts.slice(1)) assert.equal(o.getAttribute("lang"), o.value, o.textContent);
});

test("languages: each chip wraps the native name in a lang span and keeps its text unchanged", async () => {
  const { document } = await ready("languages.html");
  const items = [...document.querySelectorAll("#lList li.card")];
  assert.equal(items.length, data.rows.length);
  data.rows.forEach((row, i) => {
    const chips = [...items[i].querySelectorAll("span.tag.y")];
    assert.equal(chips.length, row.lang.length, row.title);
    chips.forEach((chip, k) => {
      const code = row.lang[k];
      const span = chip.firstElementChild;
      assert.ok(span, `chip for ${code} has no lang span`);
      assert.equal(span.tagName, "SPAN");
      assert.equal(span.getAttribute("lang"), code);
      assert.equal(chip.textContent, labels.get(code), `chip text for ${code} changed`);
    });
  });
});

test("languages: the English word in brackets stays outside the lang span", async () => {
  const { document } = await ready("languages.html");
  const chip = [...document.querySelectorAll("#lList span.tag.y")].find((c) => c.firstElementChild && c.firstElementChild.getAttribute("lang") === "es");
  assert.ok(chip, "no Spanish chip");
  assert.equal(chip.firstElementChild.textContent, "Español");
  assert.equal(chip.textContent, "Español (Spanish)");
  assert.doesNotMatch(chip.firstElementChild.textContent, /Spanish/);
  const tl = [...document.querySelectorAll("#lList span.tag.y")].find((c) => c.firstElementChild && c.firstElementChild.getAttribute("lang") === "tl");
  assert.ok(tl, "no Tagalog chip");
  assert.equal(tl.textContent, "Tagalog");
});

test("languages: every official page link has hreflang equal to the first code in its row", async () => {
  const { document } = await ready("languages.html");
  const links = [...document.querySelectorAll("#lList a.btn")].filter((a) => /Open the official page/.test(a.textContent));
  assert.equal(links.length, data.rows.length);
  links.forEach((a, i) => {
    assert.equal(a.getAttribute("hreflang"), data.rows[i].lang[0], data.rows[i].title);
    assert.match(a.textContent.trim(), /^Open the official page/);
  });
});

test("languages: picking Spanish gives every visible link hreflang es", async () => {
  const { window, document } = await ready("languages.html");
  type(window, document.getElementById("lLang"), "es");
  await tick(60);
  const links = [...document.querySelectorAll("#lList a.btn")].filter((a) => /Open the official page/.test(a.textContent));
  assert.ok(links.length > 0);
  for (const a of links) assert.equal(a.getAttribute("hreflang"), "es");
});

test("languages: ?lang=es in the address gives every visible link hreflang es", async () => {
  const { document } = await ready("languages.html", { search: "?lang=es" });
  const links = [...document.querySelectorAll("#lList a.btn")];
  assert.ok(links.length > 0);
  for (const a of links) assert.equal(a.getAttribute("hreflang"), "es");
});

test("languages: a hostile code like __proto__ throws no error and adds no lang attribute", async () => {
  const { document, errors } = await ready("languages.html", { search: "?lang=__proto__" });
  assert.deepEqual(errors, []);
  assert.equal(document.querySelectorAll('[lang="__proto__"]').length, 0);
  for (const el of document.querySelectorAll("[lang]")) assert.notEqual(el.getAttribute("lang"), "__proto__");
  for (const a of document.querySelectorAll("#lList a.btn")) assert.notEqual(a.getAttribute("hreflang"), "__proto__");
  assert.doesNotMatch(document.getElementById("lCount").textContent, /object|undefined|NaN/i);
});

test("languages: no em dash or en dash in the changed files", () => {
  for (const f of ["assets/js/languages.js", "tests/r3-a11y-perf-4.test.mjs"]) {
    const text = fs.readFileSync(path.join(root, f), "utf8");
    assert.doesNotMatch(text, new RegExp("[\\u2013\\u2014]"), f);
  }
});
