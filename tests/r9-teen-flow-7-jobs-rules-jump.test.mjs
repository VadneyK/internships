// Ticket r1-teen-flow-7: the Jobs page has a visible "Jump to the hours and safety rules" link near the top,
// pointing at the in-page #rules section. Run with: node --test tests/r9-teen-flow-7-jobs-rules-jump.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick, type } from "./dom-helper.mjs";

test("r9-teen-flow-7: Jobs page has a jump link to #rules in the lede area, and the target is a real section with an h2", async () => {
  const { window, document, errors } = await loadPage("jobs.html");
  await tick(150);
  type(window, document.getElementById("jAge"), "15");
  await tick(50);

  const link = [...document.querySelectorAll("a")].find((a) => a.getAttribute("href") === "#rules");
  assert.ok(link, "a link with href='#rules' exists");
  assert.match(link.textContent.trim(), /Jump to the hours and safety rules/);
  assert.ok(link.closest(".wrap"), "link sits inside the top wrap, not in the footer");
  assert.ok(link.compareDocumentPosition(document.getElementById("rules")) & window.Node.DOCUMENT_POSITION_FOLLOWING, "link comes before the rules section");

  const fragment = link.getAttribute("href").slice(1);
  const target = document.getElementById(fragment);
  assert.ok(target, "the fragment resolves to an element by id");
  assert.equal(target.tagName, "SECTION");
  assert.ok(target.querySelector("h2"), "the rules section has an h2");
  assert.deepEqual(errors, [], "no script errors");
});

test("r9-teen-flow-7: the jump link is static HTML in the built page, not added by script", async () => {
  const { document } = await loadPage("jobs.html");
  const link = [...document.querySelectorAll("p.lede ~ p a")].find((a) => a.getAttribute("href") === "#rules");
  assert.ok(link, "the link is in the markup after the lede");
});
