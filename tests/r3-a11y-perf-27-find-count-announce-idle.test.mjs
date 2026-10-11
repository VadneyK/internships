// Ticket r3-a11y-perf-5: Find speaks the program count only after typing stops.
// Run with: node --test tests/r3-a11y-perf-27-find-count-announce-idle.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick, type } from "./dom-helper.mjs";

async function ready() {
  const p = await loadPage("find.html");
  for (let i = 0; i < 80 && /Loading/.test(p.document.getElementById("count").textContent); i++) await tick(25);
  return p;
}

test("#count is not a live region; #countLive is a status region", async () => {
  const { document } = await ready();
  assert.equal(document.getElementById("count").hasAttribute("aria-live"), false);
  assert.equal(document.getElementById("countLive").getAttribute("role"), "status");
});

test("typing: visible count updates each letter, spoken text waits 700 ms of quiet and arrives once", async () => {
  const { window, document } = await ready();
  const count = document.getElementById("count"), live = document.getElementById("countLive");
  const writes = [];
  new window.MutationObserver(() => writes.push(live.textContent)).observe(live, { childList: true, characterData: true, subtree: true });
  const old = live.textContent;
  const q = document.getElementById("q");
  const seen = [count.textContent];
  let v = "";
  for (const ch of "hospi") {
    v += ch; type(window, q, v); await tick(200);
    seen.push(count.textContent);
  }
  assert.ok(new Set(seen).size > 2, "visible count should change while typing: " + seen.join(" | "));
  assert.equal(live.textContent, old, "live region must keep old text during typing");
  assert.equal(writes.length, 0);
  await tick(800);
  await tick(10);
  assert.equal(live.textContent, count.textContent);
  assert.match(live.textContent, /^\d+ of \d+ programs$/);
  assert.equal(writes.length, 1, "final text spoken exactly once");
});

test("a chip press updates the live region within 300 ms and never leaves it empty", async () => {
  const { window, document } = await ready();
  const live = document.getElementById("countLive");
  const empties = [];
  new window.MutationObserver(() => { if (!live.textContent.trim()) empties.push(1); }).observe(live, { childList: true, characterData: true, subtree: true });
  const before = live.textContent;
  document.getElementById("onlyVerified").click();
  await tick(300);
  assert.notEqual(live.textContent, before);
  assert.match(live.textContent, /^\d+ of \d+ programs$/);
  assert.equal(empties.length, 0);
});
