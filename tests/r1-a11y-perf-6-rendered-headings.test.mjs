// Heading order after the page scripts have drawn the content (not just the static HTML).
// A screen reader user moves by heading, so there must be one h1, no skipped level, and no empty heading.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

const HEADINGS = "h1, h2, h3, h4, h5, h6";

// Headings in document order that a user can reach: skips anything inside a [hidden] subtree.
function walk(document) {
  return [...document.querySelectorAll(HEADINGS)]
    .filter((h) => !h.closest("[hidden]"))
    .map((h) => ({ level: Number(h.tagName[1]), text: (h.textContent || "").trim(), html: h.outerHTML.slice(0, 90) }));
}

function problems(list) {
  const out = [];
  const h1s = list.filter((h) => h.level === 1).length;
  if (h1s !== 1) out.push(`found ${h1s} h1 elements`);
  let prev = 0;
  for (const h of list) {
    if (prev && h.level > prev + 1) out.push(`h${prev} is followed by h${h.level}: ${h.html}`);
    if (!h.text) out.push(`empty heading: ${h.html}`);
    prev = h.level;
  }
  return out;
}

async function check(name, file, setup) {
  await test(name, async () => {
    const page = await loadPage(file);
    await tick(150);
    if (setup) await setup(page);
    await tick(100);
    assert.deepEqual(page.errors, [], "page errors");
    assert.deepEqual(problems(walk(page.document)), []);
  });
}

await check("find.html: headings after the program cards are drawn", "find.html");

await check("jobs.html: headings after age 16 is picked", "jobs.html", async ({ window, document }) => {
  type(window, document.getElementById("jAge"), "16");
});

await check("safety.html: headings after the page loads", "safety.html");
await check("parents.html: headings after the page loads", "parents.html");
await check("interview.html: headings after the page loads", "interview.html");
await check("younger.html: headings after the page loads", "younger.html");
await check("calendar.html: headings after the page loads", "calendar.html");

await check("permit.html: headings after California, 15, and a job are picked", "permit.html", async ({ window, document }) => {
  type(window, document.getElementById("pState"), "ca");
  type(window, document.getElementById("pAge"), "15");
  type(window, document.getElementById("pKind"), "job");
});
