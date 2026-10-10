// Ticket r3-teen-flow-7: resume.html gets an "On this page" chip row at the top and a Next steps section at the end.
// Run with: node --test tests/r3-teen-flow-7.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CHIPS = [
  ["#basics", "1. What goes on it"],
  ["#build", "2. Build it"],
  ["#next", "3. Next steps"],
];

const NEXT_LINKS = [
  ["interview.html", "Apply and interview prep"],
  ["playbook.html", "Write your message"],
  ["find.html", "Find a program"],
  ["permit.html", "Do I need a work permit?"],
];

test("r3-teen-flow-7: resume.html has exactly one On this page nav, marked noprint, with three chips that resolve", async () => {
  const { document, errors } = await loadPage("resume.html");
  await tick(120);

  const navs = document.querySelectorAll('nav[aria-label="On this page"]');
  assert.equal(navs.length, 1, "exactly one nav named On this page");
  const nav = navs[0];
  assert.ok(nav.classList.contains("chips"), "nav uses the chips class");
  assert.ok(nav.classList.contains("noprint"), "chip row does not print");

  const links = [...nav.querySelectorAll("a")];
  assert.equal(links.length, CHIPS.length, "chip count matches the ticket");
  links.forEach((a, i) => {
    assert.ok(a.classList.contains("chip"), "each link is a.chip");
    assert.equal(a.getAttribute("href"), CHIPS[i][0], "href matches the section id");
    assert.equal(a.textContent.trim(), CHIPS[i][1], "label matches the ticket");
    const id = (a.getAttribute("href") || "").slice(1);
    assert.ok(document.getElementById(id), "chip target exists: #" + id);
  });

  assert.deepEqual(errors, [], "no script errors on the page");
});

test("r3-teen-flow-7: basics, build and next sections carry the ids the chips use, each once", async () => {
  const { document } = await loadPage("resume.html");
  for (const id of ["basics", "build", "next"]) {
    assert.equal(document.querySelectorAll("#" + id).length, 1, "one element with id " + id);
  }
  assert.equal(document.getElementById("basics").tagName, "SECTION");
  assert.equal(document.getElementById("build").tagName, "SECTION");
  assert.equal(document.getElementById("next").tagName, "SECTION");
  assert.ok(document.getElementById("next").classList.contains("noprint"), "Next steps section does not print");
});

test("r3-teen-flow-7: the Next steps section is the last section and has the four onward links", async () => {
  const { document, errors } = await loadPage("resume.html");
  await tick(120);

  const sections = [...document.querySelectorAll("section")];
  assert.equal(sections[sections.length - 1].id, "next", "Next steps is the last section on the page");

  const next = document.getElementById("next");
  const links = [...next.querySelectorAll("a")];
  assert.equal(links.length, NEXT_LINKS.length, "Next steps has the four links");
  links.forEach((a, i) => {
    assert.equal(a.getAttribute("href"), NEXT_LINKS[i][0], "href for " + NEXT_LINKS[i][1]);
    assert.equal(a.textContent.trim(), NEXT_LINKS[i][1], "label for " + NEXT_LINKS[i][0]);
  });

  assert.deepEqual(errors, [], "no script errors on the page");
});

test("r3-teen-flow-7: every Next steps link is a local page that exists in the repo", async () => {
  const { document } = await loadPage("resume.html");
  for (const a of document.querySelectorAll("#next a")) {
    const file = a.getAttribute("href") || "";
    assert.match(file, /^[a-z-]+\.html$/, "plain local page link: " + file);
    assert.ok(fs.existsSync(path.join(ROOT, file)), "page exists in the repo: " + file);
  }
});
