// Ticket p9-handout-1: "Run it as 6 weeks" on the teacher handout.
// Six weeks in order, each with a goal, a link to a real page file and a "Bring" line.
// Run with: node --test tests/p9-handout-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const doc = new JSDOM(read("handout.html")).window.document;
const details = doc.getElementById("sixWeeks");
const weeks = [...details.querySelectorAll("ol.handout-weeks > li")];

// Expected page for each week, in order (the ticket's own list).
const EXPECTED = [
  ["Week 1", "find.html"],
  ["Week 2", "jobs.html", "permit.html"],
  ["Week 3", "playbook.html"],
  ["Week 4", "resume.html"],
  ["Week 5", "interview.html"],
  ["Week 6", "paycheck.html", "safety.html"],
];

test("the 6 week block is a collapsed details after the 45 minute section, not in the sheet", () => {
  assert.ok(details, "details#sixWeeks exists");
  assert.equal(doc.querySelectorAll("#sixWeeks").length, 1);
  assert.equal(details.tagName, "DETAILS");
  assert.equal(details.hasAttribute("open"), false, "collapsed by default");
  assert.equal(details.querySelector("summary").textContent.trim(), "Run it as 6 weeks");
  assert.ok(!doc.getElementById("handoutSheet").contains(details), "not inside the one-page sheet");
  const teach = doc.getElementById("teach");
  assert.ok(teach.compareDocumentPosition(details) & doc.defaultView.Node.DOCUMENT_POSITION_FOLLOWING, "comes after the 45 minute section");
  assert.ok(!details.classList.contains("noprint"), "prints with the lesson plan");
  assert.equal(doc.querySelectorAll("h1").length, 1, "still one h1");
});

test("exactly six weeks, in order, each with its week label", () => {
  assert.equal(weeks.length, 6);
  weeks.forEach((li, i) => {
    assert.ok(li.querySelector("b").textContent.startsWith(EXPECTED[i][0] + ":"), `week ${i + 1} label`);
  });
});

test("each week has a goal sentence, the right page links and a Bring line", () => {
  weeks.forEach((li, i) => {
    const [, ...pages] = EXPECTED[i];
    const hrefs = [...li.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
    for (const page of pages) assert.ok(hrefs.includes(page), `week ${i + 1} links ${page}`);
    const text = li.textContent.replace(/\s+/g, " ").trim();
    assert.match(text, /Bring (next week|to the wrap-up):/, `week ${i + 1} has a Bring line`);
    const goal = text.split("Bring")[0];
    assert.ok(goal.split(/[.!?]\s/).filter((s) => s.trim()).length >= 2, `week ${i + 1} has a goal sentence`);
  });
});

test("every link in the 6 week block is relative and resolves to a real page file", () => {
  const links = [...details.querySelectorAll("a[href]")];
  assert.ok(links.length >= 8, "block has its links");
  for (const a of links) {
    const href = a.getAttribute("href");
    assert.doesNotMatch(href, /^[a-z]+:|^\/\//i, `link is internal: ${href}`);
    const [file, hash] = href.split("#");
    assert.match(file, /^[a-z0-9-]+\.html$/, `link points to a root page file: ${href}`);
    const abs = path.join(ROOT, file);
    assert.ok(fs.existsSync(abs), `link target exists: ${href}`);
    if (hash) {
      const target = new JSDOM(fs.readFileSync(abs, "utf8")).window.document;
      assert.ok(target.getElementById(hash), `fragment exists in ${file}: #${hash}`);
    }
  }
});

test("no em or en dash in the block, the built page or the source page", () => {
  const dash = /[\u2013\u2014]/;
  assert.ok(!dash.test(details.textContent), "built block");
  assert.ok(!dash.test(read("handout.html")), "built page");
  assert.ok(!dash.test(read("src/handout.html")), "source page");
});
