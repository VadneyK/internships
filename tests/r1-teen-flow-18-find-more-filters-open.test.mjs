import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const BASE = "More filters: pay, kind, interest";

test("r10-teen-flow-1: a hidden filter in the link opens More filters and the summary counts it", async () => {
  const { document } = await loadPage("find.html?pay=pay"); await tick(150);
  const box = document.getElementById("moreFilters");
  assert.equal(box.open, true);
  assert.equal(box.querySelector("summary").textContent, BASE + " (1 on)");
  document.getElementById("reset").click(); await tick(60);
  assert.equal(box.querySelector("summary").textContent, BASE);
});

test("r10-teen-flow-1: with no hidden filter the box stays closed and the summary is unchanged", async () => {
  const { document } = await loadPage("find.html?age=15"); await tick(150);
  const box = document.getElementById("moreFilters");
  assert.equal(box.open, false);
  assert.equal(box.querySelector("summary").textContent, BASE);
});
