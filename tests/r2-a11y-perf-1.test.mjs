import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

const CASES = [
  { file: "playbook.html", out: "letter", status: "letterStatus", input: "fTo", re: /^Message updated\. \d+ words?\.$/ },
  { file: "leaders.html", out: "outRef", status: "refStatus", input: "rTeen", re: /^Letter updated\./ },
];

for (const c of CASES) {
  test(c.file + ": output is not a live region; one hidden status note, empty on load", async () => {
    const { document, errors } = await loadPage(c.file);
    assert.deepEqual(errors, []);
    const out = document.getElementById(c.out);
    assert.equal(out.hasAttribute("aria-live"), false);
    assert.equal(out.hasAttribute("role"), false);
    const st = document.getElementById(c.status);
    assert.ok(st.classList.contains("sr"));
    assert.equal(st.getAttribute("role"), "status");
    assert.equal(st.textContent, "");
    assert.equal(document.querySelectorAll("#" + c.status).length, 1);
  });

  test(c.file + ": status updates after a pause, and quick typing changes it at most once", async () => {
    const { window, document } = await loadPage(c.file);
    const st = document.getElementById(c.status);
    let mutations = 0;
    new window.MutationObserver((m) => { mutations += m.filter((x) => x.type === "childList").length; }).observe(st, { childList: true });
    const el = document.getElementById(c.input);
    for (const v of ["M", "Mr", "Mrs", "Mrs.", "Mrs. Lee"]) { type(window, el, v); await tick(20); }
    assert.equal(st.textContent, "");
    await tick(1200);
    assert.match(st.textContent, c.re);
    assert.ok(mutations <= 1, "status changed " + mutations + " times");
    if (c.file === "playbook.html") {
      const n = parseInt(document.getElementById("wc").textContent, 10);
      assert.equal(parseInt(st.textContent.match(/(\d+) words?/)[1], 10), n);
    }
    assert.match(document.getElementById(c.out).textContent, /Lee|\[/);
  });
}
