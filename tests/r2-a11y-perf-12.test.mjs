// Ticket r2-a11y-perf-12: the paycheck "late or wrong" card is plain content, not a live region.
// A short sr status line (#mWrongStatus) names the state after a choice. Run with: node --test tests/r2-a11y-perf-12.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

const LIVE = "[aria-live], [role=status], [role=alert]";

test("paycheck wrong-pay card: no live region on it or on any ancestor", async () => {
  const { document } = await loadPage("paycheck.html"); await tick(200);
  const card = document.getElementById("mWrong");
  assert.equal(card.hasAttribute("aria-live"), false);
  assert.equal(card.hasAttribute("role"), false);
  assert.equal(card.getAttribute("role") === "status" || card.getAttribute("role") === "alert", false);
  for (let el = card.parentElement; el; el = el.parentElement) {
    assert.equal(el.hasAttribute("aria-live"), false, "ancestor " + el.tagName + "#" + el.id + " has aria-live");
    const role = el.getAttribute("role");
    assert.ok(role !== "status" && role !== "alert" && role !== "log", "ancestor " + el.tagName + "#" + el.id + " has role " + role);
  }
});

test("paycheck wrong-pay section: exactly one sr role=status, #mWrongStatus, empty on load", async () => {
  const { document } = await loadPage("paycheck.html"); await tick(200);
  const section = document.getElementById("wrong");
  const hits = section.querySelectorAll(".sr[role=status]");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, "mWrongStatus");
  assert.equal(hits[0].textContent, "");
  assert.equal(section.querySelectorAll(LIVE).length, 1);
});

test("paycheck wrong-pay status: names the state after a choice, and never keeps the old state", async () => {
  const { window, document, errors } = await loadPage("paycheck.html"); await tick(200);
  assert.deepEqual(errors, []);
  const st = document.getElementById("mWrongStatus");
  assert.equal(st.textContent, "");

  type(window, document.getElementById("mState"), "il");
  const il = st.textContent;
  assert.ok(il.length > 0 && il.length < 80, il);
  assert.match(il, /Illinois/);
  assert.match(document.getElementById("mWrong").textContent, /13 days/);

  type(window, document.getElementById("mState"), "il");
  assert.equal(st.textContent, il);

  type(window, document.getElementById("mState"), "ny");
  const ny = st.textContent;
  assert.ok(ny.length > 0 && ny.length < 80, ny);
  assert.match(ny, /New York/);
  assert.doesNotMatch(ny, /Illinois/);
  assert.match(document.getElementById("mWrong").textContent, /New York/);
});

test("paycheck wrong-pay status: a preset that picks the state also updates the status line", async () => {
  const { window, document } = await loadPage("paycheck.html"); await tick(200);
  const st = document.getElementById("mWrongStatus");
  type(window, document.getElementById("mPreset"), "ny-up");
  assert.match(st.textContent, /New York/);
  assert.ok(st.textContent.length < 80, st.textContent);
});
