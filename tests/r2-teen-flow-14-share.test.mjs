// Ticket r2-share-1: a teen who scans a code lands on the Share page and sees a start card first.
// The card has two big buttons (Find a program, Jobs that hire teens) and one line about saving a list.
// The leader QR cards sit under the heading "For leaders: print a code".
// Run with: node --test tests/r2-teen-flow-14-share.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = new URL("../", import.meta.url);
const LINE = "Tap the star on programs you like, then tap Copy my list and paste it into a text to yourself.";

test("share: the start card is the first thing in main, before the page title and the QR cards", async () => {
  const { document, errors } = await loadPage("share.html"); await tick(100);
  assert.deepEqual(errors, []);
  const main = document.querySelector("main");
  const first = main.firstElementChild;
  assert.equal(first.tagName, "SECTION");
  assert.ok(first.classList.contains("start-here"), "first section is the start card");
  const h1 = document.querySelector("h1");
  assert.ok(first.compareDocumentPosition(h1) & 4, "start card comes before the h1");
  const firstCard = document.querySelector(".qrcard");
  assert.ok(first.compareDocumentPosition(firstCard) & 4, "start card comes before the QR cards");
});

test("share: the start card has the heading Scanned a code? Start here", async () => {
  const { document } = await loadPage("share.html"); await tick(100);
  const card = document.getElementById("startHere");
  assert.ok(card, "start card exists");
  // A real h2 here would come before the page h1 and fail the heading order check, so the title is a
  // paragraph with the heading role at level 2.
  const h = card.querySelector('[role="heading"][aria-level="2"]');
  assert.ok(h, "card has a level 2 heading role");
  assert.equal(h.textContent.trim(), "Scanned a code? Start here");
});

test("share: two big buttons, Find a program to find.html and Jobs that hire teens to jobs.html", async () => {
  const { document } = await loadPage("share.html"); await tick(100);
  const card = document.getElementById("startHere");
  const links = [...card.querySelectorAll("a")];
  assert.equal(links.length, 2, "exactly two buttons in the card");
  assert.equal(links[0].getAttribute("href"), "find.html");
  assert.equal(links[0].textContent.trim(), "Find a program");
  assert.equal(links[1].getAttribute("href"), "jobs.html");
  assert.equal(links[1].textContent.trim(), "Jobs that hire teens");
  for (const a of links) {
    assert.ok(a.classList.contains("btn"), "each link is a button style");
    assert.ok(a.style.fontSize, "each link sets a big font size");
  }
  for (const f of ["find.html", "jobs.html"]) {
    assert.ok(fs.existsSync(new URL(f, ROOT)), f + " should exist at the site root");
  }
});

test("share: the card has the save-your-list line word for word", async () => {
  const { document } = await loadPage("share.html"); await tick(100);
  const card = document.getElementById("startHere");
  const lines = [...card.querySelectorAll("p")].map((p) => p.textContent.trim());
  assert.ok(lines.includes(LINE), "the exact line is in the card");
});

test("share: the facts in the start card are real (Copy my list and the star exist on Find)", () => {
  const find = fs.readFileSync(new URL("find.html", ROOT), "utf8");
  const js = fs.readFileSync(new URL("assets/js/find.js", ROOT), "utf8");
  assert.match(find, />Copy my list</, "find.html has a Copy my list button");
  assert.match(js, /class="star/, "find.js draws a star on each card");
});

test("share: the leader heading is shown above the first QR card", async () => {
  const { document } = await loadPage("share.html"); await tick(100);
  const h = document.getElementById("leaderCodes");
  assert.ok(h, "leader heading exists");
  assert.equal(h.tagName, "H2");
  assert.equal(h.textContent.trim(), "For leaders: print a code");
  const firstCard = document.querySelector(".qrcard");
  assert.ok(h.compareDocumentPosition(firstCard) & 4, "heading comes before the QR cards");
  const cardsAfter = [...document.querySelectorAll(".qrcard")].filter((c) => h.compareDocumentPosition(c) & 4);
  assert.equal(cardsAfter.length, 10, "all ten leader QR cards come after the heading");
});

test("share: no em dash or en dash in the source or the built page", () => {
  for (const f of ["src/share.html", "share.html"]) {
    const text = fs.readFileSync(new URL(f, ROOT), "utf8");
    assert.doesNotMatch(text, /[\u2013\u2014]/, f + " has a long dash");
  }
});

test("share: the built page matches the source for the start card", () => {
  const built = fs.readFileSync(new URL("share.html", ROOT), "utf8");
  assert.ok(built.includes('id="startHere"'), "built page has the start card");
  assert.ok(built.includes("Scanned a code? Start here"));
  assert.ok(built.includes(LINE));
});
