// Ticket r2-teen-flow-5: the calendar Next line keeps the teen's age and area.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const hrefOf = (document, prefix) => {
  const a = [...document.querySelectorAll("#calNext a")].find((x) => (x.getAttribute("href") || "").startsWith(prefix));
  assert.ok(a, "a Next link to " + prefix);
  return a.getAttribute("href");
};

test("calendar Next: age 15 in New York City sends the permit link with state and age, and jobs with age", async () => {
  // "ny" alone is not a place the page accepts; a New York city id is.
  const { document } = await loadPage("calendar.html", { search: "?age=15&at=city:new-york-city" });
  await tick(200);
  assert.equal(hrefOf(document, "permit.html"), "permit.html?state=ny&age=15");
  assert.equal(hrefOf(document, "jobs.html"), "jobs.html?age=15");
});

test("calendar Next: an area that spans several states keeps the permit link age only", async () => {
  // Every city we list is in a permit state, so use an area that spans states (no single state).
  const { document } = await loadPage("calendar.html", { search: "?age=16&at=area:northeast" });
  await tick(200);
  const permit = hrefOf(document, "permit.html");
  assert.equal(permit.includes("state="), false, "no state for a non-permit place: " + permit);
  assert.equal(permit, "permit.html?age=16");
  assert.equal(hrefOf(document, "jobs.html"), "jobs.html?age=16");
});

test("calendar Next: no age or place leaves the links plain", async () => {
  const { document } = await loadPage("calendar.html", { search: "?m=3" });
  await tick(200);
  assert.equal(hrefOf(document, "permit.html"), "permit.html");
  assert.equal(hrefOf(document, "jobs.html"), "jobs.html");
  assert.equal(hrefOf(document, "playbook.html"), "playbook.html");
});

test("calendar Next: an age outside 12 to 18 is not sent", async () => {
  const { document } = await loadPage("calendar.html", { search: "?age=11&at=city:new-york-city" });
  await tick(200);
  assert.equal(hrefOf(document, "permit.html"), "permit.html?state=ny");
  assert.equal(hrefOf(document, "jobs.html"), "jobs.html");
});
