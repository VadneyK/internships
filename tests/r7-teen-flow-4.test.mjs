import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const shown = (document) => [...document.querySelectorAll("#sec-call ul > li")].filter((li) => !li.closest("[hidden]")).length;
const pick = (document, window, v) => { const s = document.getElementById("sState"); s.value = v; s.dispatchEvent(new window.Event("change", { bubbles: true })); };

test("safety state filter: default shows all 15, status empty", async () => {
  const { document, errors } = await loadPage("safety.html"); await tick(300);
  assert.deepEqual(errors, []);
  assert.equal(shown(document), 15);
  assert.equal(document.getElementById("sCallStatus").getAttribute("role"), "status");
  assert.equal(document.getElementById("sCallStatus").textContent, "");
  assert.equal(document.getElementById("sOtherNote").hidden, true);
});

test("safety state filter: picks change the list and the status line", async () => {
  const { document, window } = await loadPage("safety.html"); await tick(300);
  const st = document.getElementById("sCallStatus");
  pick(document, window, "ga");
  assert.equal(shown(document), 5);
  const ga = st.textContent;
  assert.match(ga, /Georgia/);
  pick(document, window, "other");
  assert.equal(shown(document), 3);
  assert.equal(document.getElementById("sOtherNote").hidden, false);
  assert.ok(document.querySelector('#sOtherNote a[href="permit.html"]'));
  assert.notEqual(st.textContent, ga);
  pick(document, window, "");
  assert.equal(shown(document), 15);
  assert.equal(document.getElementById("sOtherNote").hidden, true);
  assert.doesNotMatch(ga + st.textContent, /[\u2013\u2014]/);
});

test("safety state filter: ?state= starts the view, bad values show all", async () => {
  let r = await loadPage("safety.html", { search: "?state=ny" }); await tick(300);
  assert.equal(shown(r.document), 5);
  assert.equal(r.document.getElementById("sState").value, "ny");
  assert.equal(r.document.getElementById("sCallStatus").textContent, "");
  r = await loadPage("safety.html", { search: "?state=zz" }); await tick(300);
  assert.equal(shown(r.document), 15);
});
