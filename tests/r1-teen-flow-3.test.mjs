// Ticket r1-teen-flow-3: the home Got a yes card shows plain next-step chips under the permit card.
// The chips (not class btn) go to ready.html, paycheck.html and safety.html. The Do I need a permit button
// still goes to permit.html and still gains ?age= after an age is picked (home.js linkAge stays on the first #offer a.btn).
// Run with: node --test tests/r1-teen-flow-3.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

test("home Got a yes card: three plain chip links to the next steps, inside #offer", async () => {
  const { document, errors } = await loadPage("index.html");
  assert.deepEqual(errors, []);
  const offer = document.getElementById("offer");
  assert.ok(offer, "#offer exists");
  const nav = offer.querySelector("nav.chips");
  assert.ok(nav, "expected a nav.chips row inside #offer");
  const links = [...nav.querySelectorAll("a")];
  assert.deepEqual(
    links.map((a) => a.getAttribute("href")),
    ["ready.html", "paycheck.html", "safety.html"],
  );
  for (const a of links) {
    assert.ok(a.classList.contains("chip"), "chip link has class chip");
    assert.ok(!a.classList.contains("btn"), "chip link must not have class btn");
    assert.ok(a.textContent.trim().length > 0, "chip link has text");
    assert.doesNotMatch(a.textContent, new RegExp("[" + String.fromCharCode(8211, 8212) + "]"), "no en or em dash in link text");
  }
  assert.equal(links[0].textContent.trim(), "Get ready for day one");
  assert.equal(links[1].textContent.trim(), "See your first paycheck");
  assert.equal(links[2].textContent.trim(), "Safe at work");
});

test("home Got a yes card: the permit button still links to permit.html and gains ?age= after an age is picked", async () => {
  const { window, document, errors } = await loadPage("index.html");
  const permit = document.querySelector("#offer a.btn");
  assert.equal(permit.getAttribute("href"), "permit.html");
  assert.equal(permit.textContent.trim(), "Do I need a permit?");
  type(window, document.getElementById("pAge"), "16");
  await tick(50);
  assert.deepEqual(errors, []);
  assert.equal(document.querySelector("#offer a.btn").getAttribute("href"), "permit.html?age=16");
  const chips = [...document.querySelectorAll("#offer nav.chips a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(chips, ["ready.html", "paycheck.html", "safety.html"], "chips do not gain ?age=");
});

// Ticket r1-teen-flow-3 (first half): one clear Your next step button at the end of Find, Calendar, Permit and Share.
const CASES = [
  { file: "find.html", href: "playbook.html", label: "Write your message" },
  { file: "calendar.html", href: "playbook.html", label: "Write your message" },
  { file: "permit.html", href: "ready.html", label: "Get ready for day one" },
  { file: "share.html", href: "find.html", label: "Try the guide yourself" },
];

for (const c of CASES) {
  test(c.file + ": ends with one clear Your next step button", async () => {
    const { document, errors } = await loadPage(c.file);
    assert.deepEqual(errors, []);
    const last = document.querySelector("main").lastElementChild;
    assert.equal(last.tagName, "SECTION");
    assert.ok(last.classList.contains("nextstep"));
    assert.equal(last.id, "next-step");
    assert.equal(document.querySelectorAll("#next-step").length, 1);
    const h2s = last.querySelectorAll("h2");
    assert.equal(h2s.length, 1);
    assert.equal(h2s[0].textContent.trim(), "Your next step");
    const btns = last.querySelectorAll("a.btn");
    assert.equal(btns.length, 1);
    assert.equal(btns[0].getAttribute("href"), c.href);
    assert.equal(btns[0].textContent.trim(), c.label);
  });

  test(c.file + ": one h1, no heading skip, no em or en dash", async () => {
    const { document } = await loadPage(c.file);
    assert.equal(document.querySelectorAll("h1").length, 1);
    let prev = 0;
    for (const h of document.querySelectorAll("main h1, main h2, main h3, main h4, main h5, main h6")) {
      const lvl = Number(h.tagName[1]);
      assert.ok(lvl <= prev + 1, "heading skip before: " + h.textContent.trim());
      prev = lvl;
    }
    assert.ok(!/[\u2013\u2014]/.test(document.querySelector("#next-step").textContent));
  });

  test(c.file + ": existing elements are kept", async () => {
    const { document } = await loadPage(c.file);
    const ids = { "find.html": "gaps", "calendar.html": "calNext" }[c.file];
    if (ids) assert.ok(document.getElementById(ids));
    if (c.file === "permit.html") assert.ok([...document.querySelectorAll("h2")].some((h) => h.textContent.trim() === "Still unsure?"));
  });
}
