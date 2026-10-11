import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

const CASES = [
  { file: "resume.html", out: "rv", status: "rStatus", input: "rName", re: /^Resume updated\.$/ },
  { file: "interview.html", out: "tText", status: "tStatus", input: "tTo", re: /^Note updated\.$/ },
  { file: "permit.html", out: "mText", status: "mStatus", input: "mName", search: "?state=il&age=14&kind=job", re: /^Message updated\.$/ },
];

for (const c of CASES) {
  test(c.file + ": preview is not live; one hidden status, empty on load", async () => {
    const { document, errors } = await loadPage(c.file);
    assert.deepEqual(errors, []);
    const out = document.getElementById(c.out);
    assert.equal(out.closest("[aria-live],[role=status],[role=alert],[role=log]"), null);
    assert.equal(document.querySelectorAll("#" + c.status).length, 1);
    const st = document.getElementById(c.status);
    assert.ok(st.classList.contains("sr"));
    assert.equal(st.getAttribute("role"), "status");
    assert.equal(st.textContent, "");
  });

  test(c.file + ": status updates once after a pause", async () => {
    const { window, document } = await loadPage(c.file, { search: c.search || "" }); await tick(150);
    const st = document.getElementById(c.status);
    let mutations = 0;
    new window.MutationObserver((m) => { mutations += m.filter((x) => x.type === "childList").length; }).observe(st, { childList: true });
    const el = document.getElementById(c.input);
    for (const v of ["M", "Mr", "Mrs", "Mrs.", "Mrs. Lee"]) { type(window, el, v); await tick(20); }
    assert.equal(st.textContent, "");
    await tick(1200);
    assert.match(st.textContent, c.re);
    assert.ok(st.textContent.length < 60);
    assert.ok(mutations <= 1, "status changed " + mutations + " times");
    assert.match(document.getElementById(c.out).textContent, /Lee/);
  });
}
