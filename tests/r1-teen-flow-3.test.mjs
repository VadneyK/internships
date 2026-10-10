// Ticket r1-teen-flow-3: one clear Your next step button at the end of Find, Calendar, Permit and Share.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

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
