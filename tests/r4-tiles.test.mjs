import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadPage, tick, type } from "./dom-helper.mjs";
const require = createRequire(import.meta.url);
const L = require("../assets/js/lib.js");

test("where picker groups: every city is in exactly one part of the country, and every area id is real", () => {
  const seen = {};
  for (const [, areas, cities] of L.PICK_GROUPS) {
    for (const c of cities) { seen[c] = (seen[c] || 0) + 1; assert.ok(L.CITIES.some((x) => x[0] === c), "unknown city " + c); }
    for (const a of areas) assert.ok(L.AREAS.some((x) => x[0] === a), "unknown area " + a);
  }
  for (const c of L.CITIES) assert.equal(seen[c[0]], 1, c[0] + " must be in exactly one group");
});

test("find: Where is part-of-country tiles, then the cities in that part; a deep link opens its group", async () => {
  const { window, document } = await loadPage("find.html?at=city:boston"); await tick(150);
  const first = [...document.querySelectorAll("#place + .tp > .tp-row .tile")].map((t) => t.textContent);
  assert.deepEqual(first.slice(0, 3), ["Anywhere", "California", "Pacific Northwest"]);
  const sub = [...document.querySelectorAll("#place + .tp .tp-sub .tile")];
  assert.ok(sub.some((t) => /^All of Northeast/.test(t.textContent)), "an All of area tile");
  const boston = sub.find((t) => /^Boston/.test(t.textContent));
  assert.equal(boston.getAttribute("aria-pressed"), "true");
  const ca = [...document.querySelectorAll("#place + .tp > .tp-row .tile")].find((t) => t.textContent === "California");
  ca.click();
  assert.ok([...document.querySelectorAll("#place + .tp .tp-sub .tile")].some((t) => /^Davis/.test(t.textContent)));
  [...document.querySelectorAll("#place + .tp .tp-sub .tile")].find((t) => /^San Diego/.test(t.textContent)).click();
  assert.equal(document.getElementById("place").value, "city:san-diego");
  [...document.querySelectorAll("#place + .tp > .tp-row .tile")][0].click();
  assert.equal(document.getElementById("place").value, "");
});

test("find: age, timing and season are tap tiles that drive the same hidden select", async () => {
  const { document } = await loadPage("find.html"); await tick(150);
  for (const id of ["age", "when", "season"]) assert.ok(document.querySelectorAll("#" + id + " + .tp .tile").length >= 5, id);
  [...document.querySelectorAll("#age + .tp .tile")].find((t) => t.textContent === "15").click();
  assert.equal(document.getElementById("age").value, "15");
});
