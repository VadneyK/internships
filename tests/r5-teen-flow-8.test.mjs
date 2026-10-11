// Ticket r1-teen-flow-8 (404 page): a teen who lands on a broken link sees links to the permit finder, Get ready, Resume and Safe at work.
// Run with: node --test tests/r5-teen-flow-8.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED = ["permit.html", "ready.html", "resume.html", "safety.html"];

function load(file) {
  return new JSDOM(fs.readFileSync(path.join(ROOT, file), "utf8")).window.document;
}

// The second .chips row is the "Looking for one of these?" row.
function secondRowLinks(document) {
  const rows = document.querySelectorAll(".chips");
  assert.equal(rows.length, 2, "404 has the original chips row plus one new row");
  return [...rows[1].querySelectorAll("a")];
}

test("r1-teen-flow-8: 404 keeps the three original buttons", () => {
  const first = load("404.html").querySelectorAll(".chips")[0];
  const hrefs = [...first.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(hrefs, ["index.html", "find.html", "playbook.html"]);
});

test("r1-teen-flow-8: 404 has a plain-words label before the new row", () => {
  const document = load("404.html");
  const label = [...document.querySelectorAll("p")].find((p) => /Looking for one of these\?/.test(p.textContent));
  assert.ok(label, "label text is present");
  assert.equal(label.nextElementSibling?.classList.contains("chips"), true, "label sits directly above the chips row");
});

test("r1-teen-flow-8: 404 links to permit, ready, resume and safety", () => {
  const hrefs = secondRowLinks(load("404.html")).map((a) => a.getAttribute("href"));
  assert.deepEqual(hrefs.sort(), [...EXPECTED].sort());
});

test("r1-teen-flow-8: each 404 link is relative (no leading slash, no absolute URL)", () => {
  for (const a of secondRowLinks(load("404.html"))) {
    const href = a.getAttribute("href");
    assert.ok(!href.startsWith("/"), `${href} is not root-relative`);
    assert.ok(!/^[a-z]+:/i.test(href), `${href} is not an absolute URL`);
  }
});

test("r1-teen-flow-8: each 404 link resolves to a built file in the repo", () => {
  for (const a of secondRowLinks(load("404.html"))) {
    const href = a.getAttribute("href");
    const target = path.join(ROOT, href);
    assert.ok(fs.existsSync(target), `${href} exists as a built file`);
    assert.ok(fs.statSync(target).isFile(), `${href} is a file`);
  }
});

test("r1-teen-flow-8: the built 404.html matches the source change", () => {
  const built = fs.readFileSync(path.join(ROOT, "404.html"), "utf8");
  assert.match(built, /Looking for one of these\?/);
  for (const file of EXPECTED) assert.ok(built.includes(`href="${file}"`), `built page links ${file}`);
});

test("r1-teen-flow-8: the 404 source has no em dash or en dash", () => {
  const text = fs.readFileSync(path.join(ROOT, "src", "404.html"), "utf8");
  assert.equal(new RegExp("[\\u2013\\u2014]").test(text), false);
});
