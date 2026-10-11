import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type } from "./dom-helper.mjs";

function stub(p, answer) {
  const calls = [];
  p.window.confirm = (m) => { calls.push(m); return answer; };
  return calls;
}
const $ = (p, id) => p.document.getElementById(id);
const snap = (p) => JSON.stringify([Object.entries(p.window.localStorage), Array.from(p.document.querySelectorAll("input, textarea")).map((e) => e.type === "checkbox" ? e.checked : e.value)]);

async function run(file, btn, status, touch, check) {
  // default state: no confirm
  let p = await loadPage(file);
  let calls = stub(p, true);
  $(p, btn).click();
  assert.equal(calls.length, 0, file + " default state must not ask");
  // typed work, confirm false: nothing changes
  p = await loadPage(file);
  touch(p);
  calls = stub(p, false);
  const before = snap(p);
  $(p, btn).click();
  assert.equal(calls.length, 1);
  assert.ok(calls[0].length > 10 && !/[\u2013\u2014]/.test(calls[0]));
  assert.equal(snap(p), before);
  // confirm true: cleared and announced
  calls = stub(p, true);
  $(p, btn).click();
  assert.equal(calls.length, 1);
  assert.notEqual(snap(p), before);
  assert.ok($(p, status).textContent.trim().length > 0, status + " has text");
  check(p);
  assert.ok(p.document.body.contains(p.document.activeElement) && p.document.activeElement !== p.document.body);
}

test("resume: Clear everything", async () => {
  await run("resume.html", "rClear", "rStatus", (p) => type(p.window, $(p, "rName"), "Sam Teen"), (p) => assert.equal($(p, "rName").value, ""));
  const p = await loadPage("resume.html");
  assert.equal($(p, "rClear").textContent.trim(), "Clear everything");
});
test("ready: Start over", async () => {
  await run("ready.html", "readyReset", "readyStatus", (p) => { const b = p.document.querySelector("#readyList input"); b.checked = true; b.dispatchEvent(new p.window.Event("change", { bubbles: true })); }, (p) => assert.equal(p.document.querySelector("#readyList input").checked, false));
});
test("leaders: Clear everything I typed", async () => {
  await run("leaders.html", "clearLeader", "refStatus", (p) => type(p.window, $(p, "gName"), "My Group"), (p) => assert.equal($(p, "gName").value, ""));
});
test("playbook: Clear everything", async () => {
  await run("playbook.html", "clearMap", "toast", (p) => type(p.window, $(p, "fMe"), "Sam"), (p) => assert.equal($(p, "fMe").value, ""));
});
