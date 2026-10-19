// 2026-10-17: paycheck.js behavior that a mutation run of the page (CI run 39008427088) showed no test pinned.
// Worst for a teen first: the wage and pay rules must follow the state a link (?state=), the saved Programs area or the
// picked preset names, the New York disability and parent's-business notes must show with their amounts, and the
// "Another state" box must say when this page has a full estimate for the typed state.
// Run with: node --test tests/r10-tests-3-mut-paycheck-page.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, waitFor } from "./dom-helper.mjs";

async function open(opts = {}) {
  const p = await loadPage("paycheck.html", opts);
  await waitFor(() => p.document.getElementById("mPreset").options.length > 2 && p.document.getElementById("mWrong").textContent);
  return p;
}
const $ = (p, id) => p.document.getElementById(id);

test("?state=ga picks the Georgia preset and wage, and ?state=IL the first Illinois preset", async () => {
  const ga = await open({ search: "?state=ga" });
  assert.equal($(ga, "mPreset").value, "ga");
  assert.equal($(ga, "mState").value, "ga");
  assert.equal($(ga, "mWage").value, "7.25");
  assert.match($(ga, "mWrong").querySelector("h3").textContent, /^Georgia$/);
  ga.window.close();
  const il = await open({ search: "?state=IL" });
  assert.equal($(il, "mPreset").value, "il-youth");
  assert.equal($(il, "mState").value, "il");
  assert.equal($(il, "mWage").value, "13.00");
  il.window.close();
});

test("the area saved on Programs picks its state when this page covers it; the address and other states leave California", async () => {
  const atl = await open({ storage: { findprefs: { place: "city:atlanta" } } });
  assert.equal($(atl, "mPreset").value, "ga");
  assert.equal($(atl, "mState").value, "ga");
  assert.equal($(atl, "mWage").value, "7.25");
  atl.window.close();
  const chi = await open({ storage: { findprefs: { place: "city:chicago" } } });
  assert.equal($(chi, "mPreset").value, "il-youth");
  assert.equal($(chi, "mState").value, "il");
  chi.window.close();
  const boston = await open({ storage: { findprefs: { place: "city:boston" } } });
  assert.equal($(boston, "mPreset").value, "ca", "Massachusetts has no estimate here");
  assert.equal($(boston, "mState").value, "ca");
  boston.window.close();
  const both = await open({ storage: { findprefs: { place: "city:atlanta" } }, search: "?state=ny" });
  assert.equal($(both, "mPreset").value, "ny-nyc", "the address wins over the saved area");
  both.window.close();
});

test("picking a preset moves the late or wrong pay box to that state and says so; the Next links follow it", async () => {
  const p = await open();
  type(p.window, $(p, "mPreset"), "il-adult");
  await waitFor(() => $(p, "mState").value === "il");
  assert.match($(p, "mWrong").querySelector("h3").textContent, /^Illinois$/);
  assert.equal($(p, "mWrongStatus").textContent, "Showing pay rules for Illinois.");
  assert.equal($(p, "mWage").value, "15.00");
  const hrefs = [...p.document.querySelectorAll("main a[href]")].map((a) => a.getAttribute("href"));
  assert.ok(hrefs.includes("interview.html?state=il"), hrefs.filter((h) => /interview/.test(h)).join(","));
  assert.ok(hrefs.includes("find.html"), "find stays as it is");
  $(p, "mWrongStatus").textContent = "";
  type(p.window, $(p, "mPreset"), "il-youth");
  await waitFor(() => $(p, "mWage").value === "13.00");
  assert.equal($(p, "mWrongStatus").textContent, "", "the same state again is not announced again");
  type(p.window, $(p, "mState"), "ny");
  await waitFor(() => /New York/.test($(p, "mWrongStatus").textContent));
  assert.equal($(p, "mWrongStatus").textContent, "Showing pay rules for New York.");
  p.window.close();
});

test("New York shows the disability note with its amount; a parent's business adds its note and source", async () => {
  const p = await open({ search: "?state=ny" });
  type(p.window, $(p, "mWage"), "20");
  type(p.window, $(p, "mHours"), "10");
  await waitFor(() => /\$183\.84/.test($(p, "mOut").textContent));
  assert.match($(p, "mOut").textContent, /That would be up to \$0\.60\./);
  assert.equal($(p, "mOut").querySelectorAll("ul.small li").length, 4, "three line notes plus the disability note");
  $(p, "mParent").checked = true;
  $(p, "mParent").dispatchEvent(new p.window.Event("change", { bubbles: true }));
  await waitFor(() => $(p, "mOut").querySelectorAll("ul.small li").length === 5);
  assert.ok($(p, "mOut").querySelector('ul.small li a[target="_blank"]'), "the parent's-business note links its source");
  p.window.close();
  const ga = await open({ search: "?state=ga" });
  assert.doesNotMatch($(ga, "mOut").textContent, /That would be up to/);
  ga.window.close();
});

test("0 hours is a valid entry, not an error; a negative rate is", async () => {
  const p = await open();
  type(p.window, $(p, "mHours"), "0");
  await waitFor(() => /\$0\.00/.test($(p, "mOut").textContent));
  assert.equal($(p, "mHours").hasAttribute("aria-invalid"), false);
  assert.equal($(p, "mHoursNote").hidden, true);
  type(p.window, $(p, "mWage"), "0");
  assert.equal($(p, "mWage").hasAttribute("aria-invalid"), false);
  type(p.window, $(p, "mWage"), "-1");
  assert.equal($(p, "mWage").getAttribute("aria-invalid"), "true");
  assert.equal($(p, "mWageNote").textContent, "The hourly rate can not be below 0.");
  p.window.close();
});

test("Another state: the list is in name order, and a state with a full estimate says so", async () => {
  const p = await open();
  type(p.window, $(p, "mPreset"), "other");
  await waitFor(() => $(p, "mOtherState").options.length > 40);
  const names = [...$(p, "mOtherState").options].filter((o) => o.value).map((o) => o.textContent);
  assert.deepEqual(names, names.slice().sort((a, b) => (a < b ? -1 : 1)));
  assert.equal($(p, "mOtherBox").hidden, false);
  type(p.window, $(p, "mOtherState"), "il");
  await waitFor(() => /minimum wage for Illinois/.test($(p, "mStatus").textContent));
  assert.match($(p, "mOtherWage").textContent, /This page has a full estimate for this state\./);
  type(p.window, $(p, "mOtherState"), "tx");
  await waitFor(() => /minimum wage for Texas/.test($(p, "mStatus").textContent));
  assert.doesNotMatch($(p, "mOtherWage").textContent, /full estimate/);
  type(p.window, $(p, "mPreset"), "ca");
  await waitFor(() => $(p, "mOtherBox").hidden);
  assert.equal($(p, "mOther").hidden, true);
  assert.equal($(p, "mWage").value, "16.90");
  p.window.close();
});
