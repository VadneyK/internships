// Ticket r2-teen-flow-2: the calendar age picker carries into the permit and jobs links.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const hrefs = (d) => ["calNextPermit", "calNextJobs", "cNoneJobs"].map((id) => d.getElementById(id).getAttribute("href"));
const setAge = async (d, w, v) => { const s = d.getElementById("cAge"); s.value = v; s.dispatchEvent(new w.Event("change", { bubbles: true })); await tick(50); };

test("calendar age carry: links follow every age change", async () => {
  const { document, window } = await loadPage("calendar.html", { search: "?m=3" });
  await tick(200);
  assert.deepEqual(hrefs(document), ["permit.html", "jobs.html", "jobs.html"]);
  await setAge(document, window, "15");
  assert.deepEqual(hrefs(document), ["permit.html?age=15", "jobs.html?age=15", "jobs.html?age=15"]);
  await setAge(document, window, "12");
  assert.deepEqual(hrefs(document), ["permit.html", "jobs.html?age=u14", "jobs.html?age=u14"]);
  await setAge(document, window, "");
  assert.deepEqual(hrefs(document), ["permit.html", "jobs.html", "jobs.html"]);
});

test("calendar age carry: saved age sets the links on first load", async () => {
  const { document } = await loadPage("calendar.html", { search: "?age=13" });
  await tick(200);
  assert.deepEqual(hrefs(document), ["permit.html", "jobs.html?age=u14", "jobs.html?age=u14"]);
});
