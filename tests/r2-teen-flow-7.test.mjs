// Ticket r2-teen-flow-7: Home gets a "Jump to" chip row, and the picked age carries into the permit and deadline links.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

const PLAIN_PERMIT = "permit.html";
const PLAIN_DEADLINES = "find.html?view=dates";

async function loadHome() {
  const page = await loadPage("index.html");
  await tick(120);
  return page;
}

test("r2-teen-flow-7: Jump to nav sits in the hero with three links that resolve to ids", async () => {
  const { document, errors } = await loadHome();

  const navs = document.querySelectorAll('nav.chips[aria-label="Jump to"]');
  assert.equal(navs.length, 1, "exactly one Jump to nav");
  const links = [...navs[0].querySelectorAll("a")];
  assert.deepEqual(
    links.map((a) => a.textContent.trim()),
    ["What fits me", "Closing soon", "Work permit"],
    "labels match the ticket",
  );
  assert.deepEqual(
    links.map((a) => a.getAttribute("href")),
    ["#start", "#soon", "#offer"],
    "hrefs match the ticket",
  );
  for (const a of links) {
    const href = a.getAttribute("href") || "";
    assert.match(href, /^#/, href + " should be a fragment link");
    assert.ok(document.getElementById(href.slice(1)), "no element with id " + href.slice(1));
  }
  assert.deepEqual(errors, [], "no script errors on the page");
});

test("r2-teen-flow-7: with no age chosen both links are the plain ones", async () => {
  const { document, errors } = await loadHome();

  assert.equal(document.querySelector("#offer a.btn").getAttribute("href"), PLAIN_PERMIT);
  assert.equal(document.querySelector("#soon a.btn").getAttribute("href"), PLAIN_DEADLINES);
  assert.deepEqual(errors, [], "no script errors on the page");
});

test("r2-teen-flow-7: picking 15 carries the age into both links", async () => {
  const { window, document, errors } = await loadHome();

  type(window, document.getElementById("pAge"), "15");
  await tick(30);

  assert.equal(document.querySelector("#offer a.btn").getAttribute("href"), "permit.html?age=15");
  assert.equal(document.querySelector("#soon a.btn").getAttribute("href"), "find.html?view=dates&age=15");
  assert.deepEqual(errors, [], "no script errors on the page");
});

test("r2-teen-flow-7: clearing the age restores the plain links", async () => {
  const { window, document, errors } = await loadHome();

  type(window, document.getElementById("pAge"), "15");
  await tick(30);
  type(window, document.getElementById("pAge"), "");
  await tick(30);

  assert.equal(document.querySelector("#offer a.btn").getAttribute("href"), PLAIN_PERMIT);
  assert.equal(document.querySelector("#soon a.btn").getAttribute("href"), PLAIN_DEADLINES);
  assert.deepEqual(errors, [], "no script errors on the page");
});
