import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, type, tick } from "./dom-helper.mjs";

async function pick(st, age, kind = "job") {
  const p = await loadPage("permit.html"); await tick();
  type(p.window, p.document.getElementById("pState"), st);
  type(p.window, p.document.getElementById("pAge"), age);
  type(p.window, p.document.getElementById("pKind"), kind);
  await tick();
  return p;
}
const out = (p) => p.document.getElementById("pOut");

test("r2-permit-1: not listed at 12 uses the under 14 answer", async () => {
  const p = await pick("other", "12");
  const t = out(p).textContent;
  assert.match(t, /Federal law says under 14 may not be employed in most non-farm jobs\. A state can be stricter, and then the stricter rule applies\. Ask your state labor office\./);
  assert.doesNotMatch(t, /most states do not allow regular jobs|usually do not need a permit/);
  assert.ok(out(p).querySelector('a[href="younger.html"]'));
  assert.ok(out(p).querySelector('a[href*="state-labor-offices"]'));
});

test("r2-permit-1: not listed at 15 keeps the existing wording", async () => {
  const p = await pick("other", "15");
  assert.match(out(p).textContent, /have not read your state/);
  assert.doesNotMatch(out(p).textContent, /most states do not allow regular jobs/);
});

test("r2-permit-1: not listed at 18 says no minor permit", async () => {
  const p = await pick("other", "18");
  assert.match(out(p).textContent, /You are 18\. You do not need a minor work permit\. Go to Jobs that hire teens\./);
  assert.ok(out(p).querySelector('a[href="jobs.html?age=18"]'));
  assert.equal(p.document.getElementById("packetSec").hidden, true);
});

test("r2-permit-1: age 18 in a listed state shows the line on top and no school form", async () => {
  const p = await pick("ca", "18");
  const card = out(p).querySelector("article");
  assert.equal(card.firstElementChild.id, "pAdultLine");
  assert.match(card.firstElementChild.textContent, /You are 18\. You do not need a minor work permit\. Go to Jobs that hire teens\./);
  assert.ok(card.firstElementChild.querySelector('a[href="jobs.html?age=18"]'));
  assert.equal(p.document.getElementById("packetSec").hidden, true);
});

for (const age of ["14", "15"]) {
  test("r2-permit-1: British Columbia at " + age + " shows a plain answer from the data", async () => {
    const d = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));
    const p = await pick("bc", age);
    const plain = out(p).querySelector("#pBcPlain");
    assert.ok(plain);
    const items = [...plain.querySelectorAll("li")].map((x) => x.textContent);
    assert.deepEqual(items, d.states.bc.steps);
    assert.match(plain.textContent, /written permission/);
  });
}

test("r2-permit-1: British Columbia at 16 has no plain 14 and 15 block", async () => {
  const p = await pick("bc", "16");
  assert.equal(out(p).querySelector("#pBcPlain"), null);
});
