// A deep link find.html#p-<id> focuses that card, and every card is named by its h3.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage } from "./dom-helper.mjs";

const DATA = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

test("hash for a real program focuses its card", async () => {
  const id = DATA[0].id;
  const { document, errors } = await loadPage("find.html", { search: "#p-" + id });
  assert.equal(document.activeElement.id, "p-" + id);
  assert.deepEqual(errors, []);
});

test("every card is named by its own h3", async () => {
  const { document } = await loadPage("find.html");
  const cards = [...document.querySelectorAll("article.prog")];
  assert.ok(cards.length > 0);
  const ids = new Set();
  for (const c of cards) {
    const lid = c.getAttribute("aria-labelledby");
    assert.ok(lid, "aria-labelledby on " + c.id);
    assert.ok(!ids.has(lid), "duplicate id " + lid);
    ids.add(lid);
    const h = c.querySelector("#" + lid);
    assert.ok(h, "label element inside " + c.id);
    assert.equal(h.textContent, DATA.find((e) => "p-" + e.id === c.id).name);
    assert.equal(document.querySelectorAll('[id="' + lid + '"]').length, 1);
  }
});

test("no hash leaves focus on body", async () => {
  const { document } = await loadPage("find.html");
  assert.equal(document.activeElement, document.body);
});

test("unknown hash does not throw or focus", async () => {
  const { document, errors } = await loadPage("find.html", { search: "#p-no-such-program-xyz" });
  assert.equal(document.activeElement, document.body);
  assert.deepEqual(errors, []);
});
