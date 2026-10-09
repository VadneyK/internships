import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";

const GAPS = JSON.parse(fs.readFileSync(new URL("../data/gaps.json", import.meta.url), "utf8"));

test("gaps.json: every gap has a title, text, a whole-number issue and known hub ids", () => {
  const hubs = new Set(["davis", "sv", "oak", "sf", "state", "socal", "atl", "nyc", "chi", "online"]);
  const ids = new Set();
  for (const g of GAPS) {
    assert.ok(g.title && g.text, g.id + " needs a title and text");
    assert.ok(Number.isInteger(g.issue) && g.issue > 0, g.id + " needs an issue number");
    assert.ok(!ids.has(g.id), "duplicate id " + g.id); ids.add(g.id);
    for (const h of g.hubs) assert.ok(hubs.has(h), g.id + " has unknown hub " + h);
    assert.ok(!/[\u2013\u2014]/.test(g.title + g.text), g.id + " has a dash character");
  }
});

test("contribute page lists every known gap with a link to its issue", async () => {
  const { document, errors } = await loadPage("contribute.html");
  assert.deepEqual(errors, []);
  const links = [...document.querySelectorAll("#gaps .gaplist a")].map((a) => a.getAttribute("href"));
  for (const g of GAPS) assert.ok(links.some((h) => h.endsWith("/issues/" + g.issue)), "missing link for issue " + g.issue);
});

test("programs page shows the known gaps only for the area you filtered to", async () => {
  const none = await loadPage("find.html");
  assert.equal(none.document.getElementById("gaps").hidden, true);
  const oak = await loadPage("find.html", { search: "?where=oak" });
  await tick(100);
  const box = oak.document.getElementById("gaps");
  assert.equal(box.hidden, false);
  assert.ok(box.querySelector('a[href$="/issues/2"]'), "East Bay filter should link issue 2");
  assert.equal(box.querySelector('a[href$="/issues/4"]'), null, "Davis-only gap should not show for the East Bay");
  const davis = await loadPage("find.html", { search: "?where=davis" });
  await tick(100);
  assert.ok(davis.document.getElementById("gaps").querySelector('a[href$="/issues/4"]'));
});
