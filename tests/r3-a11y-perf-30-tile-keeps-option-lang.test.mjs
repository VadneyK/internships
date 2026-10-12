// Language picker tiles keep the lang of each option, on the native part only.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("languages.html: tiles carry the option lang on the native name only", async () => {
  const { window, document, errors } = await loadPage("languages.html");
  await wait(300);
  const sel = document.getElementById("lLang");
  const tiles = [...document.querySelectorAll(".tp .tile")];
  const opts = [...sel.options].filter((o) => o.value !== "" || o.hasAttribute("lang"));
  let checked = 0;
  for (const o of sel.options) {
    const lang = o.getAttribute("lang");
    const tile = tiles.find((t) => t.textContent === o.textContent);
    if (!tile) continue;
    if (!lang) { assert.equal(tile.hasAttribute("lang"), false); assert.equal(tile.querySelector("[lang]"), null); continue; }
    const sp = tile.querySelector("span[lang=" + JSON.stringify(lang) + "]");
    assert.ok(sp, "lang span on tile for " + lang);
    const m = /^(.*?)( \([^()]*\))$/.exec(o.textContent);
    assert.equal(sp.textContent, m ? m[1] : o.textContent);
    if (m) assert.equal(sp.nextSibling.textContent, m[2], "English bracket sits outside the span");
    checked++;
  }
  assert.ok(checked >= 5, "checked tiles with lang: " + checked);
  const es = document.querySelector('.tp span[lang="es"]').closest("button");
  es.focus(); es.click();
  assert.equal(sel.value, "es");
  const after = document.querySelector('.tp span[lang="es"]').closest("button");
  assert.equal(after.getAttribute("aria-pressed"), "true");
  assert.equal(document.activeElement, after);
  assert.deepEqual(errors, []);
  window.close();
});
