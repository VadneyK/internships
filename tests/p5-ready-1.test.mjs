// Ticket p5-ready-1: Get ready counter reads "N of 8 done" (never "0 of 0"), section 3 has an
// "Open a bank account" card with a bring list and two custodial and joint lines, and the
// "Not in California" line no longer says every card in section 3 is California only.
// Run with: node --test tests/p5-ready-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const ITEM_COUNT = (rd("assets/js/ready.js").match(/^\s*\["[a-z]+", "/gm) || []).length;

test("p5-ready-1: the checklist has 8 items in ready.js and the static counter matches", () => {
  assert.equal(ITEM_COUNT, 8, "ready.js ITEMS should hold 8 entries");
  for (const file of ["src/ready.html", "ready.html"]) {
    const src = rd(file);
    assert.match(src, new RegExp(`id="readySum">0 of ${ITEM_COUNT} done<`), file + " static counter");
    assert.doesNotMatch(src, /0 of 0 done/, file + " must never show 0 of 0");
  }
});

test("p5-ready-1: the counter reads 0 of 8 on load and changes with each box", async () => {
  const { window, document, errors } = await loadPage("ready.html");
  assert.deepEqual(errors, []);
  assert.equal(document.getElementById("readySum").textContent, "0 of 8 done");
  const box = document.querySelectorAll("#readyList input")[0];
  box.checked = true;
  box.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(document.getElementById("readySum").textContent, "1 of 8 done");
  await tick(10);
});

test("p5-ready-1: the bank card is the first card in section 3 and has a bring list of four", async () => {
  const { document } = await loadPage("ready.html");
  const grid = document.querySelector("#money .grid");
  const first = grid.querySelector("article.card");
  assert.equal(first.querySelector("h3").textContent.trim(), "Open a bank account");
  const items = [...first.querySelectorAll("ul li")].map((li) => li.textContent.trim());
  assert.equal(items.length, 4, "four things to bring");
  assert.match(items[0], /photo ID/);
  assert.match(items[0], /student ID/);
  assert.match(items[1], /parent or guardian/);
  assert.match(items[2], /Social Security number or card/);
  assert.match(items[3], /Proof of address/);
});

test("p5-ready-1: the bank card has one line each for custodial and joint accounts, and no numbers", async () => {
  const { document } = await loadPage("ready.html");
  const card = document.querySelector("#money .grid article.card");
  const custodial = [...card.querySelectorAll("p")].find((p) => p.querySelector("b")?.textContent === "Custodial account:");
  const joint = [...card.querySelectorAll("p")].find((p) => p.querySelector("b")?.textContent === "Joint account:");
  assert.ok(custodial, "a custodial account line");
  assert.ok(joint, "a joint account line");
  assert.match(custodial.textContent, /you own the money, and an adult manages it\./);
  assert.match(joint.textContent, /an adult you trust shares it/);
  assert.deepEqual(card.textContent.match(/\d+/g) || [], [], "the bank card has no numbers");
});

test("p5-ready-1: the bank card source link is https, safe to open, and its name is unique in section 3", async () => {
  const { document } = await loadPage("ready.html");
  const card = document.querySelector("#money .grid article.card");
  const link = card.querySelector("a");
  assert.match(link.href, /^https:\/\/www\.consumerfinance\.gov\//);
  assert.match(link.getAttribute("rel") || "", /noopener/);
  const names = [...document.querySelectorAll("#money a")].map((a) => a.textContent.trim());
  assert.equal(names.filter((n) => n === link.textContent.trim()).length, 1, "link name used once in #money");
});

test("p5-ready-1: the section 3 opening line no longer calls every card California only", async () => {
  const { document } = await loadPage("ready.html");
  const p = document.getElementById("money").querySelector("h2").nextElementSibling;
  assert.match(p.textContent, /^Not in California\? The bank card is for every state\. The other cards mostly cover California\./);
  assert.doesNotMatch(document.getElementById("money").textContent, /cards below are for California only/);
  assert.ok(p.querySelector('a[href="paycheck.html"]'), "still links to paycheck.html");
  assert.ok(p.querySelector('a[href="permit.html"]'), "still links to permit.html");
});

test("p5-ready-1: the built page carries the bank card and the source file has no en or em dash", () => {
  const built = rd("ready.html");
  assert.match(built, /<h3>Open a bank account<\/h3>/);
  assert.match(built, /<b>Custodial account:<\/b> you own the money, and an adult manages it\./);
  assert.match(built, /<b>Joint account:<\/b> an adult you trust shares it\./);
  for (const file of ["src/ready.html", "assets/js/ready.js", "ready.html"]) {
    assert.doesNotMatch(rd(file), /[\u2013\u2014]/, file + " has no en or em dash");
  }
});
