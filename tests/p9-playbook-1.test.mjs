// Ticket p9-playbook-1: the Playbook has a collapsed "I do not know anyone yet" section near the top.
// It holds three tips that need no contacts and links to the volunteer list. Run with: node --test tests/p9-playbook-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage } from "./dom-helper.mjs";

const SRC = fs.readFileSync(new URL("../src/playbook.html", import.meta.url), "utf8");
const DASHES = /[\u2013\u2014]/;

test("playbook: collapsed 'I do not know anyone yet' section sits before the people map", async () => {
  const { document, errors } = await loadPage("playbook.html");
  assert.deepEqual(errors, []);
  const sec = document.getElementById("no-contacts");
  assert.ok(sec, "section#no-contacts exists");
  const details = sec.querySelector("details.acc");
  assert.ok(details, "section uses a details.acc block");
  assert.equal(details.hasAttribute("open"), false, "section is collapsed by default");
  assert.equal(details.querySelector("summary").textContent.trim(), "I do not know anyone yet");
  const map = document.getElementById("map");
  assert.ok(map, "people map section exists");
  assert.ok(
    sec.compareDocumentPosition(map) & document.defaultView.Node.DOCUMENT_POSITION_FOLLOWING,
    "the section comes before #map",
  );
});

test("playbook: the section has three tips, each with a step heading", async () => {
  const { document } = await loadPage("playbook.html");
  const items = document.querySelectorAll("#no-contacts details ol.steps > li");
  assert.equal(items.length, 3);
  for (const li of items) assert.ok(li.querySelector("h3"), "each tip has a heading");
  const text = document.querySelector("#no-contacts").textContent;
  assert.match(text, /school counselor, a teacher, a coach or a librarian/);
  assert.match(text, /club, a library teen group or a volunteer shift/);
  assert.match(text, /local business or a credit union/);
  assert.match(text, /Tips/);
});

test("playbook: the volunteer link points at find.html?kind=volunteer and the target page exists", async () => {
  const { document } = await loadPage("playbook.html");
  const link = document.querySelector('#no-contacts a[href="find.html?kind=volunteer"]');
  assert.ok(link, "volunteer link is inside the new section");
  assert.equal(link.textContent.trim(), "Find volunteer roles");
  assert.ok(fs.existsSync(new URL("../find.html", import.meta.url)), "find.html is built");
});

test("playbook: source template has the same section and no en or em dash", () => {
  assert.match(SRC, /<section id="no-contacts"/);
  assert.match(SRC, /<summary>I do not know anyone yet<\/summary>/);
  const start = SRC.indexOf('<section id="no-contacts"');
  const end = SRC.indexOf("</section>", start);
  const block = SRC.slice(start, end);
  assert.equal(DASHES.test(block), false, "no en or em dash in the new section");
});
