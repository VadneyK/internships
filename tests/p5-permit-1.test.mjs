import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

async function pick(st, age, kind) {
  const p = await loadPage("permit.html"); await tick();
  type(p.window, p.document.getElementById("pState"), st);
  type(p.window, p.document.getElementById("pAge"), age);
  type(p.window, p.document.getElementById("pKind"), kind);
  await tick();
  return p;
}

for (const age of ["16", "17"]) {
  test("p5-permit-1: Illinois at " + age + " gets a plain no-permit line and closed under-16 steps", async () => {
    const p = await pick("il", age, "job");
    const out = p.document.getElementById("pOut");
    const line = out.querySelector("#pNoPermitLine");
    assert.ok(line);
    assert.equal(line.textContent, "You do not need a work permit here at this age. Your employer may still ask for proof of age.");
    const d = out.querySelector("details");
    assert.ok(d);
    assert.equal(d.open, false);
    assert.equal(d.querySelector("summary").textContent, "If you were under 16");
    assert.match(d.textContent, /letter of intent/i);
    assert.equal(out.querySelectorAll("details").length, 1);
    assert.equal(out.querySelector("article > ol"), null, "steps only live inside the details");
    assert.match(out.textContent, /do not need a permit at/);
  });
}

test("p5-permit-1: Illinois at 15 still shows the steps with no top line", async () => {
  const p = await pick("il", "15", "job");
  const out = p.document.getElementById("pOut");
  assert.equal(out.querySelector("#pNoPermitLine"), null);
  assert.equal(out.querySelector("details"), null);
  assert.match(out.textContent, /Employment certificate/i);
});

for (const age of ["12", "13"]) {
  test("p5-permit-1: New York at " + age + " gets a working papers card", async () => {
    const p = await pick("ny", age, "job");
    const out = p.document.getElementById("pOut");
    assert.match(out.querySelector("h2").textContent, /Working papers \(permit\) start at 14/);
    assert.match(out.textContent, /start at 14 for almost any job in New York/);
    assert.match(out.textContent, /888-469-7365/);
    assert.ok(out.querySelector('a[href^="younger.html"]'));
    assert.doesNotMatch(out.textContent, /undefined|NaN/);
  });
}

test("p5-permit-1: New York at 15 says working papers (permit) in headings", async () => {
  const p = await pick("ny", "15", "job");
  const out = p.document.getElementById("pOut");
  assert.match(out.querySelector("h2").textContent, /You need working papers \(permit\)/);
  assert.match(out.textContent, /Who gives you working papers \(permit\)/);
  assert.equal(p.document.getElementById("packetSec").hidden, false);
});
