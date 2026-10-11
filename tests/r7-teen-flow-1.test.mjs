// Home: the Closing soon list follows the age and area picked (ticket r7-teen-flow-1).
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

test("soon list follows the saved age, and returns to 8 rows when cleared", async () => {
  const { document, window, errors } = await loadPage("index.html", { storage: { findprefs: { age: "12" } } });
  const rows = () => [...document.querySelectorAll("#soonList li[data-id]")];
  assert.equal(document.getElementById("soonStatus").textContent, "", "no status on load");
  const cardsRes = await window.fetch("data/entries-card.json");
  const raw = await cardsRes.json();
  const list = Array.isArray(raw) ? raw : raw.entries || raw.rows || [];
  const byId = Object.fromEntries(list.map((e) => [e.id, e]));
  assert.ok(rows().length > 0);
  for (const li of rows()) {
    const e = byId[li.dataset.id];
    assert.ok(e, "card data found for " + li.dataset.id);
    assert.ok(!(e.min_age > 12), li.dataset.id + " starts above 12");
  }
  assert.match(document.getElementById("soonNote").textContent, /age 12/);
  assert.equal(document.getElementById("soonNote").hidden, false);
  const age = document.getElementById("pAge");
  age.value = "";
  age.dispatchEvent(new window.Event("change", { bubbles: true }));
  await tick();
  assert.equal(rows().length, 8);
  assert.equal(document.getElementById("soonNote").hidden, true);
  assert.match(document.getElementById("soonStatus").textContent, /^8 closing soon deadlines/);
  assert.deepEqual(errors, []);
});
