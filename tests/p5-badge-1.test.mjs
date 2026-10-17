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
  // MIT WTP: open now, deadline 2026-12-21. (2026-10-17: the first fixtures, Aurora and Cook Memorial, closed and lost their deadline_iso.)
  const { document } = await loadPage("find.html?q=" + encodeURIComponent("MIT Women's Technology Program"), { now: at(2026, 12, 15) });
  await tick(200);
  const card = [...document.querySelectorAll("article.prog")].find((a) => a.querySelector("h3") && /^MIT Women's Technology Program/.test(a.querySelector("h3").textContent));
  assert.ok(card, "card is shown");
  const badge = [...card.querySelectorAll(".row .tag")].find((t) => /^Closes /.test(t.textContent.trim()));
  assert.ok(badge, "badge is in the status row");
  assert.equal(badge.textContent.trim(), "Closes in 6 days");
  assert.ok(badge.classList.contains("warn"));
});

test("p5-badge-1: a deadline tomorrow says Closes tomorrow, and a deadline today says Closes today", async () => {
  assert.deepEqual(await badgeFor("MIT Women's Technology Program", at(2026, 12, 20)), ["Closes tomorrow"]); // due 2026-12-21
  assert.deepEqual(await badgeFor("Summer Ventures in Science and Mathematics", at(2027, 1, 5)), ["Closes today"]); // due 2027-01-05
});

test("p5-badge-1: a deadline 15 days away (past the 14 day window) gets no badge", async () => {
  // Design Hive: open now, deadline 2026-10-25, which is 15 days after 2026-10-10
  assert.deepEqual(await badgeFor("Design Hive", at(2026, 10, 10)), []);
});

test("p5-badge-1: a program whose deadline has passed gets no badge", async () => {
  // MIT WTP on 2026-12-22 is past its 2026-12-21 deadline
  assert.deepEqual(await badgeFor("MIT Women's Technology Program", at(2026, 12, 22)), []);
});
