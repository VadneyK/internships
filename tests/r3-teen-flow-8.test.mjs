// Ticket r3-teen-flow-8: younger.html ends its money section with a "Next" paragraph (#yNext) that links onward.
// Run with: node --test tests/r3-teen-flow-8.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const NEXT_LINKS = [
  ["find.html?age=13", "programs that take your age"],
  ["permit.html", "work permit finder"],
  ["resume.html", "first resume"],
];

test("r3-teen-flow-8: #yNext exists once, sits in the money section, and has the three onward links", async () => {
  const { document, errors } = await loadPage("younger.html");
  await tick(120);

  assert.equal(document.querySelectorAll("#yNext").length, 1, "one element with id yNext");
  const next = document.getElementById("yNext");
  assert.equal(next.tagName, "P");
  assert.ok(next.closest("#money"), "yNext is inside the #money section");
  assert.equal(document.getElementById("n13").tagName, "SPAN", "top button count id is still intact");

  const links = [...next.querySelectorAll("a")];
  assert.equal(links.length, NEXT_LINKS.length, "three links in the Next paragraph");
  links.forEach((a, i) => {
    assert.equal(a.getAttribute("href"), NEXT_LINKS[i][0], "href for " + NEXT_LINKS[i][1]);
    assert.equal(a.textContent.trim(), NEXT_LINKS[i][1], "link text for " + NEXT_LINKS[i][0]);
  });

  assert.deepEqual(errors, [], "no script errors on the page");
});

test("r3-teen-flow-8: the Next link texts are unique within the money section", async () => {
  const { document } = await loadPage("younger.html");
  const money = document.getElementById("money");
  const texts = [...money.querySelectorAll("a")].map((a) => a.textContent.trim());
  assert.equal(new Set(texts).size, texts.length, "no duplicate link text in #money: " + texts.join(" | "));
  for (const [, label] of NEXT_LINKS) {
    assert.equal(texts.filter((t) => t === label).length, 1, "exactly one link named: " + label);
  }
});

test("r3-teen-flow-8: the Next paragraph sits before the Questions line", async () => {
  const { document } = await loadPage("younger.html");
  const next = document.getElementById("yNext");
  const questions = [...document.querySelectorAll("#money p")].find((p) => /Questions about a program\?/.test(p.textContent));
  assert.ok(questions, "Questions line is still on the page");
  assert.ok(next.compareDocumentPosition(questions) & 4, "yNext comes before the Questions line");
});
