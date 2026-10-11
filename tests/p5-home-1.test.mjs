// Ticket p5-home-1: paying-job card, goal chips, picker help line, closing-soon fallback.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";

const src = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");

test("p5-home-1: paying job card sits above the referral section with three buttons", async () => {
  const { document, errors } = await loadPage("index.html"); await tick(200);
  const card = document.getElementById("job-now");
  assert.ok(card, "card exists");
  assert.match(card.textContent, /I want a paying job now/);
  assert.deepEqual([...card.querySelectorAll("a.btn")].filter((a) => !a.closest("[hidden]")).map((a) => a.getAttribute("href")), ["permit.html", "jobs.html", "playbook.html"]);
  assert.ok(card.compareDocumentPosition(document.getElementById("secret")) & 4, "card comes before #secret");
  assert.deepEqual(errors, []);
});

test("p5-home-1: goal chips use real Programs parameters", async () => {
  const { document } = await loadPage("index.html"); await tick(200);
  const hrefs = [...document.querySelectorAll("#goalChips a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(hrefs, ["jobs.html", "find.html?kind=research", "find.html?kind=pre-college", "find.html?kind=volunteer"]);
  const find = readFileSync(new URL("../assets/js/find.js", import.meta.url), "utf8");
  assert.match(find, /p\.get\("kind"\)|list\("kind"\)/);
  assert.match(readFileSync(new URL("../assets/js/lib.js", import.meta.url), "utf8"), /"research": "Research"/);
});

test("p5-home-1: help line under the picker", async () => {
  const { document } = await loadPage("index.html"); await tick(200);
  assert.equal(document.getElementById("hubHelp").textContent.trim(), "Town not listed? Pick the biggest city near you, or the Programs page for your state.");
});

test("p5-home-1: static HTML has a no-JS closing-soon sentence with a link", () => {
  assert.match(src, /id="soonList"><li>.*needs JavaScript.*href="find\.html\?view=dates"/);
  assert.doesNotMatch(src, />Loading</);
});

test("p5-home-1: empty closing-soon list links to the Programs page", async () => {
  const { document } = await loadPage("index.html", { now: Date.parse("2028-06-01T12:00:00Z") }); await tick(300);
  const li = document.getElementById("soonList");
  assert.match(li.textContent, /No confirmed deadlines/);
  assert.ok(li.querySelector('a[href^="find.html"]'));
});
