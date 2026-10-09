import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

async function pick(page, st, age, kind) {
  const { window, document } = page;
  type(window, document.getElementById("pState"), st);
  type(window, document.getElementById("pAge"), age);
  type(window, document.getElementById("pKind"), kind);
}

test("permit: loads with no errors and asks for all three answers", async () => {
  const p = await loadPage("permit.html"); await tick();
  assert.deepEqual(p.errors, []);
  assert.ok(p.document.getElementById("pState").options.length >= 19, "four first states, fourteen more, and the prompt");
  assert.match(p.document.getElementById("pOut").textContent, /Pick all three/);
  assert.equal(p.document.getElementById("packetSec").hidden, true);
});

test("permit: California 15 year old with a paid job gets the permit, steps, a message and a checklist", async () => {
  const p = await loadPage("permit.html"); await tick();
  await pick(p, "ca", "15", "job"); await tick();
  const out = p.document.getElementById("pOut").textContent;
  assert.match(out, /Permit to Employ and Work/);
  assert.match(out, /Statement of Intent/);
  assert.match(out, /3 hours/);
  assert.doesNotMatch(out, /undefined|NaN/);
  assert.equal(p.document.getElementById("packetSec").hidden, false);
  type(p.window, p.document.getElementById("mName"), "Sam");
  type(p.window, p.document.getElementById("mEmp"), "the city pool");
  assert.match(p.document.getElementById("mText").textContent, /Sam/);
  assert.match(p.document.getElementById("mText").textContent, /the city pool/);
  assert.match(p.document.getElementById("mMail").href, /^mailto:/);
  assert.match(p.document.getElementById("pPacket").textContent, /Employer: _+/);
});

test("permit: Georgia at 16 needs nothing, and an unknown answer says who to call", async () => {
  const p = await loadPage("permit.html"); await tick();
  await pick(p, "ga", "16", "job"); await tick();
  assert.match(p.document.getElementById("pOut").textContent, /do not need a permit at 16/);
  assert.equal(p.document.getElementById("packetSec").hidden, true);
  await pick(p, "ny", "15", "own"); await tick();
  assert.match(p.document.getElementById("pOut").textContent, /Check before you start/);
  assert.match(p.document.getElementById("pOut").textContent, /888-469-7365/);
});

test("permit: the page can be opened from a program card link", async () => {
  const p = await loadPage("permit.html", { search: "?state=il&age=14&kind=job" }); await tick();
  assert.match(p.document.getElementById("pOut").textContent, /Employment certificate/i);
});

test("permit: a state we have not read says so instead of a blank page", async () => {
  const p = await loadPage("permit.html", { search: "?state=zz&age=15&kind=job" }); await tick();
  assert.match(p.document.getElementById("pOut").textContent, /have not read your state/);
});

test("permit: Washington, Texas, Michigan and Ohio give a plain answer with sources", async () => {
  for (const [st, want] of [["wa", /authorization form/i], ["tx", /does not require a work permit|Certificate of Age/i], ["mi", /valid work permit/i], ["oh", /working permit/i]]) {
    const p = await loadPage("permit.html", { search: "?state=" + st + "&age=15&kind=job" }); await tick(150);
    assert.match(p.document.getElementById("pOut").textContent, want, st);
    assert.doesNotMatch(p.document.getElementById("pOut").textContent, /undefined|NaN/);
    assert.ok(p.document.querySelectorAll("#pOut a").length >= 2, st + " should link its sources");
  }
});
