// r2-a11y-perf-9: the program star is a toggle button. It keeps one stable name ("Save <name> to my list")
// and aria-pressed carries the on or off state. A screen reader must not hear "Remove ..., pressed".
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

async function loadFind(opts = {}) {
  const page = await loadPage("find.html", opts);
  const { document } = page;
  for (let i = 0; i < 80 && /Loading/.test(document.getElementById("count").textContent); i++) await tick(25);
  return page;
}

test("find star: first star has a stable Save label and aria-pressed=false", async () => {
  const { document, errors } = await loadFind();
  const star = document.querySelector("article.prog .star");
  assert.ok(star, "a star button should be rendered");
  const name = star.closest("article.prog").querySelector("h3").textContent;
  assert.equal(star.getAttribute("aria-label"), "Save " + name + " to my list");
  assert.equal(star.getAttribute("aria-pressed"), "false");
  assert.deepEqual(errors, []);
});

test("find star: clicking saves it, keeps the same label, keeps focus, and says Saved", async () => {
  const { window, document, errors } = await loadFind();
  const star = document.querySelector("article.prog .star");
  const label = star.getAttribute("aria-label");
  const id = star.getAttribute("data-id");
  star.focus();
  star.click();
  await tick();
  const same = document.querySelector('.star[data-id="' + id + '"]');
  assert.equal(same, star, "the same element should still be in the page");
  assert.equal(same.getAttribute("aria-label"), label, "the label should not change on click");
  assert.equal(same.getAttribute("aria-pressed"), "true");
  assert.equal(window.document.activeElement, star, "focus should stay on the star");
  assert.equal(document.getElementById("toast").textContent.trim(), "Saved to your list");
  assert.ok(!/Remove/.test(same.getAttribute("aria-label")), "the label must never say Remove");
  assert.deepEqual(errors, []);
});

test("find star: clicking again un-saves it with the same label and aria-pressed=false", async () => {
  const { document, errors } = await loadFind();
  const star = document.querySelector("article.prog .star");
  const label = star.getAttribute("aria-label");
  star.click();
  await tick();
  star.click();
  await tick();
  assert.equal(star.getAttribute("aria-label"), label);
  assert.equal(star.getAttribute("aria-pressed"), "false");
  assert.ok(!/Remove/.test(star.getAttribute("aria-label")), "the label must never say Remove");
  assert.deepEqual(errors, []);
});

test("find star: saved cards keep the stable label with aria-pressed=true after Show more", async () => {
  const first = await loadFind();
  const id = first.document.querySelector("article.prog .star").getAttribute("data-id");
  const { document, errors } = await loadFind({ storage: { saved: [id] } });
  const more = document.getElementById("more");
  assert.ok(more, "Show more should be offered so the re-render path is covered");
  more.click();
  await tick();
  const star = document.querySelector('.star[data-id="' + id + '"]');
  assert.ok(star, "the saved card should still be on the page after Show more");
  assert.equal(star.getAttribute("aria-pressed"), "true");
  const name = star.closest("article.prog").querySelector("h3").textContent;
  assert.equal(star.getAttribute("aria-label"), "Save " + name + " to my list");
  assert.ok(!/Remove/.test(star.getAttribute("aria-label")), "the label must never say Remove");
  assert.deepEqual(errors, []);
});
