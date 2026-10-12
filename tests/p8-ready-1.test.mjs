// Ticket p8-ready-1: Get ready has a closed block for people 18 or older, or with no parent to help.
// Run with: node --test tests/p8-ready-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage } from "./dom-helper.mjs";

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

test("p8-ready-1: the no-parent block is a closed details with the exact summary", async () => {
  const { document, errors } = await loadPage("ready.html");
  assert.deepEqual(errors, []);
  const box = document.getElementById("no-parent");
  assert.ok(box, "details with id no-parent exists");
  assert.equal(box.tagName, "DETAILS");
  assert.equal(box.hasAttribute("open"), false, "closed by default");
  assert.equal(box.querySelector("summary").textContent.trim(), "18 or older, or no parent to help?");
});

test("p8-ready-1: the block does not use the callout class, so the one-callout rule holds", async () => {
  const { document } = await loadPage("ready.html");
  const box = document.getElementById("no-parent");
  assert.equal(box.classList.contains("callout"), false);
  assert.equal(box.querySelectorAll(".callout").length, 0);
});

test("p8-ready-1: the block sits near the top, before the jump chips and the checklist", async () => {
  const { document } = await loadPage("ready.html");
  const box = document.getElementById("no-parent");
  const chips = document.querySelector("nav.chips");
  const list = document.getElementById("readyList");
  assert.ok(box.compareDocumentPosition(chips) & document.DOCUMENT_POSITION_FOLLOWING, "block comes before nav.chips");
  assert.ok(box.compareDocumentPosition(list) & document.DOCUMENT_POSITION_FOLLOWING, "block comes before #readyList");
});

test("p8-ready-1: the Words you will see box still follows the jump chips", async () => {
  const { document } = await loadPage("ready.html");
  const chips = document.querySelector("nav.chips");
  assert.equal(chips.nextElementSibling, document.getElementById("words"));
});

test("p8-ready-1: the block has the four plain steps", async () => {
  const { document } = await loadPage("ready.html");
  const items = [...document.querySelectorAll("#no-parent li")].map((li) => li.textContent.trim());
  assert.equal(items.length, 4);
  assert.equal(items[0], "Whether a parent must sign a work permit depends on your age and state. The permit finder shows the rule for your age.");
  assert.match(items[1], /^Papers: You choose which acceptable documents to show\. A passport alone works \(see your papers\)\. A birth certificate, a Social Security card \(a replacement is free\) or a state ID can also be part of your set\.$/);
  assert.match(items[2], /^Bank account: ask the bank what ID and proof of address it needs before you go\. See Open a bank account\.$/);
  assert.match(items[3], /^For help getting documents, ask a school counselor or another adult you trust\./);
});

test("p8-ready-1: the links go to the permit finder, the card, the bank card, find.html and jobs.html?age=18", async () => {
  const { document } = await loadPage("ready.html");
  const box = document.getElementById("no-parent");
  const hrefs = [...box.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(hrefs, ["permit.html", "#ssn-card", "#bank-account", "find.html", "jobs.html?age=18"]);
});

test("p8-ready-1: the #ssn-card and #bank-account targets exist in the sections the block points to", async () => {
  const { document } = await loadPage("ready.html");
  const card = document.getElementById("ssn-card");
  assert.ok(card, "ssn-card exists");
  assert.ok(card.closest("#papers"), "the card is in section 2, Your papers");
  assert.match(card.textContent, /replacement is free/i);
  const bank = document.getElementById("bank-account");
  assert.ok(bank, "bank-account exists");
  assert.ok(bank.closest("#money"), "the bank card is in section 3, Getting paid");
  assert.equal(bank.querySelector("h3").textContent.trim(), "Open a bank account");
});

test("p8-ready-1: the block makes no legal claim about signing your own forms", async () => {
  const { document } = await loadPage("ready.html");
  const text = document.getElementById("no-parent").textContent;
  assert.doesNotMatch(text, /sign your own|can sign|may sign|on your own/i);
});

test("p8-ready-1: the lede stays one paragraph and at most 45 words", async () => {
  const { document } = await loadPage("ready.html");
  const lede = document.querySelector("p.lede");
  assert.ok(lede);
  assert.ok(lede.textContent.trim().split(/\s+/).length <= 45);
  assert.equal(lede.textContent.includes("18 or older"), false);
});

test("p8-ready-1: ready.html source and build have no em or en dash", () => {
  for (const file of ["src/ready.html", "ready.html"]) {
    const src = rd(file);
    assert.equal(src.includes(EM), false, file + " has an em dash");
    assert.equal(src.includes(EN), false, file + " has an en dash");
  }
});
