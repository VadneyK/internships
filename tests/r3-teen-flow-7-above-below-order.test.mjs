// r3-teen-flow-7: the words "above" and "below" in page text must point at something on that side.
// Ticket 1 found copy that said "the grid above" for a block that comes after. Static text in src/*.html and the JSON strings
// that fill a page can drift the same way when sections are moved. For each teen page this loads the built page with its real
// scripts, finds text nodes that say above or below close to table, grid, picker, list, card, rules or row, and checks that the
// page has a table, .tablewrap, select, ul, ol or .card on that side of the text in document order.
// Allow-list: sentences that point at something this check cannot see (see ALLOW below), each with a reason.
// Negative control (run once by hand, 2026-10-10): putting the "grid above" strings back in data/younger.json (near.*) made this
// test fail on younger.html with the page and sentence printed; restoring the strings made it pass again.
// Run with: node --test tests/r3-teen-flow-7-above-below-order.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const PAGES = ["permit", "interview", "paycheck", "younger", "calendar", "ready", "playbook", "resume", "jobs", "safety", "find"];
// What counts as the thing a noun points at. Only elements inside <main> count, so the menu list in the header never satisfies a sentence.
const TARGET_FOR = {
  table: "table, .tablewrap",
  grid: "table, .tablewrap, #grid, .grid, select",
  picker: "select",
  list: "ul, ol",
  card: ".card",
  rules: "table, .tablewrap, ul, ol, .card",
  row: "table, .tablewrap, tr",
};
const NOUN = "(?:table|grid|picker|list|card|cards|rules|row|rows)";
const DIR = "(?:above|below)";
// direction then noun, or noun then direction, within a few words: "the grid above", "above the picker", "list below"
const NEAR = new RegExp(`\\b${NOUN}\\b(?:\\W+\\w+){0,3}?\\W+\\b(${DIR})\\b|\\b(${DIR})\\b(?:\\W+\\w+){0,3}?\\W+\\b${NOUN}\\b`, "i");

// page -> [{ includes: text the sentence contains, why: reason the check cannot see the target }]
const ALLOW = [];

const sentencesOf = (text) => text.replace(/\s+/g, " ").split(/(?<=[.!?:])\s+/);

function findProblems(file, document, window) {
  const problems = [];
  const walker = document.createTreeWalker(document.body, window.NodeFilter.SHOW_TEXT);
  const main = document.querySelector("main") || document.body;
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement && node.parentElement.closest("script, style, noscript, template")) continue;
    for (const s of sentencesOf(node.nodeValue)) {
      const m = NEAR.exec(s);
      if (!m) continue;
      const dir = (m[1] || m[2]).toLowerCase();
      const noun = (/\b(table|grid|picker|list|card|rules|row)s?\b/i.exec(s) || [])[1].toLowerCase();
      const targets = [...main.querySelectorAll(TARGET_FOR[noun])];
      if (ALLOW.some((a) => a.page === file && s.includes(a.includes))) continue;
      const ok = targets.some((el) => {
        if (el.contains(node)) return false;
        const pos = node.compareDocumentPosition(el);
        return dir === "above" ? !!(pos & window.Node.DOCUMENT_POSITION_PRECEDING) : !!(pos & window.Node.DOCUMENT_POSITION_FOLLOWING);
      });
      if (!ok) problems.push(`${file}.html says "${dir}" but nothing to point at is on that side: ${s.trim()}`);
    }
  }
  return problems;
}

for (const page of PAGES) {
  test(`r3-teen-flow-7: ${page}.html "above" and "below" match document order`, async () => {
    const { document, window } = await loadPage(page + ".html");
    await tick(150);
    const problems = findProblems(page, document, window);
    assert.deepEqual(problems, [], "\n" + problems.join("\n"));
  });
}

test("r3-teen-flow-7: the check itself catches a wrong side and accepts a right one", async () => {
  const { document, window } = await loadPage("safety.html");
  const probe = (html) => { document.body.innerHTML = "<main>" + html + "</main>"; return findProblems("t", document, window); };
  assert.equal(probe("<p>Check the list below.</p><ul><li>x</li></ul>").length, 0, "list is after the text");
  assert.equal(probe("<p>See the grid above.</p><div class=tablewrap><table></table></div>").length, 1, "grid is after the text, not above it");
  assert.equal(probe("<select></select><p>Use the picker above.</p>").length, 0, "picker is before the text");
  assert.equal(probe("<ul><li>x</li></ul><p>Check the list below.</p>").length, 1, "list is before the text, not below it");
});
