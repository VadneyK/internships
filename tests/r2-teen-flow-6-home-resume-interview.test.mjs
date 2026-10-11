// Ticket r2-teen-flow-6: Home's "Move 2" card links to the resume and interview pages.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

test("r2-teen-flow-6: #moves links to playbook, resume and interview, and keeps three article cards", async () => {
  const { document, errors } = await loadPage("index.html"); await tick(200);
  const moves = document.getElementById("moves");
  assert.ok(moves, "moves section exists");
  const hrefs = [...moves.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.ok(hrefs.includes("playbook.html"), "links to playbook.html");
  assert.ok(hrefs.includes("resume.html"), "links to resume.html");
  assert.ok(hrefs.includes("interview.html"), "links to interview.html");
  assert.equal(moves.querySelectorAll("article").length, 3, "exactly three move cards");
  const move2 = [...moves.querySelectorAll("article")].find((a) => /Move 2/.test(a.textContent));
  assert.ok(move2, "Move 2 card exists");
  assert.match(move2.textContent, /Asked for a resume or an interview\?/);
  assert.deepEqual(errors, [], "no script errors on the page");
});
