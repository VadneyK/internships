import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

const CASES = [
  { file: "paycheck.html", href: "safety.html", label: "Read Safe at work" },
  { file: "safety.html", href: "share.html", label: "Share this guide with a friend" },
  { file: "interview.html", href: "permit.html", label: "Got an offer? Check your permit" },
  { file: "parents.html", href: "permit.html", label: "Find the permit for your teen" },
];

for (const c of CASES) {
  test(c.file + ": ends with one clear Your next step button", async () => {
    const { document, errors } = await loadPage(c.file);
    assert.deepEqual(errors, []);
    const main = document.querySelector("main");
    const last = main.lastElementChild;
    assert.equal(last.tagName, "SECTION");
    assert.ok(last.classList.contains("nextstep"));
    assert.equal(last.id, "next-step");
    assert.equal(document.querySelectorAll("#next-step").length, 1);
    assert.equal(last.querySelector("h2").textContent.trim(), "Your next step");
    const btns = last.querySelectorAll("a.btn");
    assert.equal(btns.length, 1);
    assert.equal(btns[0].getAttribute("href"), c.href);
    assert.equal(btns[0].textContent.trim(), c.label);
    assert.equal(last.querySelectorAll("a").length, 1);
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
    const text = document.querySelector("#next-step").textContent;
    assert.ok(!/[\u2013\u2014]/.test(text));
  });

  test(c.file + ": old Next paragraphs are kept", async () => {
    const { document } = await loadPage(c.file);
    const ids = { "paycheck.html": "mNext", "safety.html": "sNext" }[c.file];
    if (ids) assert.ok(document.getElementById(ids));
  });
}
