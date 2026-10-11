// Get ready: a closed "Words you will see" box sits right after the jump chips,
// in the same markup as the Paycheck box, and defines only terms the page already explains.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

const TERMS = ["Form I-9", "List A", "W-4", "DE 4", "SDI", "Custodial account"];

test("ready.html: Words you will see box is closed and follows the jump chips", async () => {
  const { document, errors } = await loadPage("ready.html");
  assert.deepEqual(errors, []);
  const box = document.getElementById("words");
  assert.ok(box, "box with id words exists");
  assert.equal(box.tagName, "DETAILS");
  assert.equal(box.hasAttribute("open"), false, "closed by default");
  assert.equal(box.querySelector("summary").textContent.trim(), "Words you will see");
  const chips = document.querySelector("nav.chips");
  assert.ok(chips, "jump chip row exists");
  assert.equal(chips.nextElementSibling, box, "box sits right after the chip row");
  assert.equal(document.querySelectorAll("#words").length, 1);
});

test("ready.html: box uses the same markup as the Paycheck box", async () => {
  const { document } = await loadPage("ready.html");
  const box = document.getElementById("words");
  assert.ok(box.classList.contains("callout"));
  assert.ok(box.classList.contains("plain"));
  assert.ok(box.classList.contains("small"));
  assert.ok(box.querySelector(":scope > dl"), "definitions in a dl");
});

test("ready.html: box defines the six required terms", async () => {
  const { document } = await loadPage("ready.html");
  const terms = [...document.querySelectorAll("#words dt")].map((d) => d.textContent.trim());
  for (const t of TERMS) {
    assert.ok(terms.some((x) => x.includes(t)), "missing term: " + t);
  }
  assert.equal(terms.length, 6, "exactly six terms: " + terms.join(" | "));
});

test("ready.html: box links only to 'See how' anchors on this page, and no dash characters", async () => {
  const { document } = await loadPage("ready.html");
  const box = document.getElementById("words");
  const links = [...box.querySelectorAll("a")];
  assert.equal(links.length, 6, "one See how link per term");
  for (const a of links) {
    assert.equal(a.textContent.trim(), "See how");
    const id = a.getAttribute("href").slice(1);
    assert.ok(document.getElementById(id), "anchor target exists: " + id);
  }
  assert.ok(!/[\u2013\u2014]/.test(box.textContent), "no en or em dash");
});
