import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

test("ready: toggling a checkbox keeps focus on it and announces the count", async () => {
  const { window, document, errors } = await loadPage("ready.html");
  const boxes = () => [...document.querySelectorAll("#readyList input[type=checkbox]")];
  const N = boxes().length;
  assert.equal(document.getElementById("readyStatus").textContent, "");
  const first = boxes()[0]; first.focus(); first.click();
  const k = first.getAttribute("data-k");
  assert.equal(document.activeElement.type, "checkbox");
  assert.equal(document.activeElement.getAttribute("data-k"), k);
  assert.ok(document.activeElement.checked);
  assert.equal(JSON.parse(window.localStorage.getItem("ready"))[k], true);
  assert.equal(document.getElementById("readySum").textContent, "1 of " + N + " done");
  const st = document.querySelectorAll("#readyStatus.sr[role=status]");
  assert.equal(st.length, 1);
  assert.equal(st[0].textContent, "1 of " + N + " done");
  const last = boxes()[N - 1]; last.focus(); last.click(); last.click();
  assert.equal(document.activeElement.getAttribute("data-k"), last.getAttribute("data-k"));
  assert.equal(document.activeElement.checked, false);
  assert.equal(JSON.parse(window.localStorage.getItem("ready"))[last.getAttribute("data-k")], false);
  assert.deepEqual(errors, []);
});

test("ready: Start over unchecks everything and keeps focus on the button", async () => {
  const { document } = await loadPage("ready.html", { storage: { ready: { job: true, docs: true } } });
  const reset = document.getElementById("readyReset");
  reset.focus(); reset.click();
  assert.ok([...document.querySelectorAll("#readyList input")].every((b) => !b.checked));
  assert.equal(document.activeElement, reset);
});

test("ready: district and ride answers are not live regions; short status lines announce them", async () => {
  const { window, document, errors } = await loadPage("ready.html"); await tick(120);
  for (const [out, st] of [["distOut", "distStatus"], ["rideOut", "rideStatus"]]) {
    const o = document.getElementById(out);
    assert.equal(o.hasAttribute("aria-live"), false);
    assert.equal(o.hasAttribute("role"), false);
    const s = document.querySelectorAll("#" + st + ".sr[role=status]");
    assert.equal(s.length, 1);
    assert.equal(s[0].textContent, "");
  }
  type(window, document.getElementById("dist"), "davis");
  assert.equal(document.getElementById("distStatus").textContent, "Steps for Davis Joint Unified are listed below.");
  const rs = document.getElementById("rideSel");
  const opt = [...rs.options].find((o) => o.value && o.value !== "other");
  type(window, rs, opt.value);
  assert.equal(document.getElementById("rideStatus").textContent, "Transit answer for " + opt.textContent + " is listed below.");
  assert.deepEqual(errors, []);
});
