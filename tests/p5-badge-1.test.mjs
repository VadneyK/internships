// Closes-in badge on Programs cards. Uses a fixed clock (loadPage's now option) so the day counts never drift.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const at = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0).getTime(); // local noon, so the day count is never a clock-change edge

async function badgeFor(name, now) {
  const { document } = await loadPage("find.html?q=" + encodeURIComponent(name), { now });
  await tick(200);
  const card = [...document.querySelectorAll("article.prog")].find((a) => a.querySelector("h3") && a.querySelector("h3").textContent.trim().indexOf(name) === 0);
  assert.ok(card, "card for " + name);
  return [...card.querySelectorAll(".row .tag")].map((t) => t.textContent.trim()).filter((t) => /^Closes /.test(t));
}

test("p5-badge-1: an open program due in 6 days shows Closes in 6 days, in the status row", async () => {
  // Youth Climate Action Fund: open now, deadline 2026-10-16
  const { document } = await loadPage("find.html?q=" + encodeURIComponent("Youth Climate Action Fund microgrants"), { now: at(2026, 10, 10) });
  await tick(200);
  const card = [...document.querySelectorAll("article.prog")].find((a) => a.querySelector("h3") && /^Youth Climate Action Fund/.test(a.querySelector("h3").textContent));
  assert.ok(card, "card is shown");
  const badge = [...card.querySelectorAll(".row .tag")].find((t) => /^Closes /.test(t.textContent.trim()));
  assert.ok(badge, "badge is in the status row");
  assert.equal(badge.textContent.trim(), "Closes in 6 days");
  assert.ok(badge.classList.contains("warn"));
});

test("p5-badge-1: a deadline tomorrow says Closes tomorrow, and a deadline today says Closes today", async () => {
  assert.deepEqual(await badgeFor("Youth Climate Action Fund microgrants", at(2026, 10, 15)), ["Closes tomorrow"]); // due 2026-10-16
  assert.deepEqual(await badgeFor("Teen Volunteers: Tech Tutors, Local History and Summer Volunteers", at(2026, 10, 15)), ["Closes today"]); // due 2026-10-15
});

test("p5-badge-1: a deadline 15 days away (past the 14 day window) gets no badge", async () => {
  // Design Hive: open now, deadline 2026-10-25, which is 15 days after 2026-10-10
  assert.deepEqual(await badgeFor("Design Hive", at(2026, 10, 10)), []);
});

test("p5-badge-1: a program whose deadline has passed gets no badge", async () => {
  // Youth Climate Action Fund on 2026-10-17 is past its 2026-10-16 deadline
  assert.deepEqual(await badgeFor("Youth Climate Action Fund microgrants", at(2026, 10, 17)), []);
});
