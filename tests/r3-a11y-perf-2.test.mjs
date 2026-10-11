import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

function watch(window, node) {
  const o = { n: 0 };
  new window.MutationObserver((rs) => { o.n += rs.filter((r) => r.type === "childList" || r.type === "characterData").length; })
    .observe(node, { childList: true, characterData: true, subtree: true });
  return o;
}
function structure(document, out, status, id) {
  const o = document.getElementById(out);
  assert.equal(o.hasAttribute("aria-live"), false);
  assert.equal(o.hasAttribute("role"), false);
  const sts = document.querySelectorAll(".sr[role=status]:not(#mStatus):not(#tStatus)");
  assert.equal(sts.length, 1);
  assert.equal(sts[0].id, status);
  assert.equal(sts[0].textContent, "");
  assert.equal(document.querySelectorAll("#" + status).length, 1);
}

test("permit: result is not live; one short status line, empty on load", async () => {
  const { window, document, errors } = await loadPage("permit.html"); await tick(300);
  assert.deepEqual(errors, []);
  structure(document, "pOut", "pStatus");
  const st = document.getElementById("pStatus");
  const w = watch(window, st);
  type(window, document.getElementById("pState"), "ca");
  type(window, document.getElementById("pAge"), "15");
  type(window, document.getElementById("pKind"), "job");
  const head = document.querySelector("#pOut h2").textContent;
  assert.ok(st.textContent.includes(head));
  assert.ok(st.textContent.length > 0 && st.textContent.length < 200);
  assert.ok(document.querySelector("#pOut h3"), "full answer still shown");
  assert.ok(w.n <= 3);
  type(window, document.getElementById("pState"), "");
  type(window, document.getElementById("pAge"), "");
  type(window, document.getElementById("pKind"), "");
  assert.match(st.textContent, /^Pick /);
  assert.ok(st.textContent.length < 100);
});

test("permit: two quick changes change the status at most twice", async () => {
  const { window, document } = await loadPage("permit.html"); await tick(300);
  type(window, document.getElementById("pState"), "ca");
  type(window, document.getElementById("pAge"), "15");
  const w = watch(window, document.getElementById("pStatus"));
  type(window, document.getElementById("pKind"), "job");
  type(window, document.getElementById("pAge"), "16");
  assert.ok(w.n <= 2, "changed " + w.n);
});

test("states: result is not live; status is the state name", async () => {
  const { window, document, errors } = await loadPage("states.html"); await tick(300);
  assert.deepEqual(errors, []);
  structure(document, "moreOut", "moreStatus");
  const st = document.getElementById("moreStatus");
  const sel = document.getElementById("moreSel");
  const k = sel.options[1].value;
  const w = watch(window, st);
  type(window, sel, k);
  const head = document.querySelector("#moreOut h3").textContent;
  assert.ok(st.textContent.includes(head));
  assert.ok(st.textContent.length < 200);
  type(window, sel, "");
  assert.equal(st.textContent, "Pick a state.");
  type(window, sel, k);
  assert.ok(w.n <= 3);
});

test("interview: result is not live; status is the hours line, empty on load", async () => {
  const { window, document, errors } = await loadPage("interview.html"); await tick(300);
  assert.deepEqual(errors, []);
  structure(document, "aOut", "aStatus");
  const st = document.getElementById("aStatus");
  type(window, document.getElementById("aAge"), "15");
  type(window, document.getElementById("aState"), "ca");
  const head = document.querySelector("#aOut h3").textContent;
  assert.match(head, /hours a week offered/);
  assert.ok(st.textContent.includes(head));
  assert.ok(st.textContent.length < 200);
  type(window, document.getElementById("aAge"), "");
  assert.match(st.textContent, /^Pick /);
  assert.ok(st.textContent.length < 100);
  type(window, document.getElementById("aAge"), "15");
  const w = watch(window, st);
  type(window, document.getElementById("aState"), "ga");
  type(window, document.getElementById("aState"), "ca");
  assert.ok(w.n <= 2, "changed " + w.n);
});
