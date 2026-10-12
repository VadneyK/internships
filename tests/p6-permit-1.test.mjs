import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, type, tick } from "./dom-helper.mjs";

async function pick(lite, age) {
  const p = await loadPage("permit.html"); await tick();
  const d = p.document;
  type(p.window, d.getElementById("pState"), "lite"); await tick(); await tick();
  type(p.window, d.getElementById("pLite"), lite);
  type(p.window, d.getElementById("pAge"), age);
  type(p.window, d.getElementById("pKind"), "job");
  await tick(); await tick();
  return d.getElementById("pOut");
}
const first = (out) => out.querySelector("#pLiteCard").firstElementChild;

for (const age of ["14", "15"]) {
  test("p6-permit-1: Alabama at " + age + " opens with the hours text", async () => {
    const out = await pick("al", age);
    assert.match(first(out).textContent, new RegExp("^At your age \\(" + age + "\\):"));
    assert.match(first(out).textContent, /18 hours a week/);
  });
}
test("p6-permit-1: Kansas at 15 keeps the quiet Not stated style", async () => {
  const out = await pick("ks", "15");
  assert.ok(first(out).querySelector(".ns"));
  assert.match(first(out).textContent, /We did not find hour limits on the state page we read/);
  assert.doesNotMatch(first(out).textContent, /Not stated on the page we read/);
});
for (const age of ["16", "17"]) {
  test("p6-permit-1: Alabama at " + age + " says federal law sets no hour limits", async () => {
    const out = await pick("al", age);
    const t = first(out).textContent;
    assert.match(t, new RegExp("^At your age \\(" + age + "\\):"));
    assert.match(t, /Federal law sets no hour limits for 16 and 17/);
    assert.match(t, /Your state may\. This short answer does not say; confirm with the office\./);
    assert.doesNotMatch(t, /did not say anything different/);
    assert.ok(out.querySelector("#pLiteNote"));
  });
}

// Every state in states-lite.json, at 16 and 17. Only the states listed here name both ages in one sentence of the hours row,
// so only they take the "states limits for 16 and 17" branch. Each other state takes the federal branch, which says the state may differ.
const HOURS_NAME_16_AND_17 = new Set(["ut"]);
const lite = JSON.parse(fs.readFileSync(new URL("../data/states-lite.json", import.meta.url), "utf8"));
const FEDERAL = /Federal law sets no hour limits for 16 and 17 \(source: .*\)\. Your state may\. This short answer does not say; confirm with the office\./;
const STATE_ROW = /The hours row below states limits for 16 and 17\. Read it for your age\./;

test("p6-permit-1: every lite state at 16 and 17 takes the branch its hours row earns", async () => {
  const p = await loadPage("permit.html"); await tick(); const d = p.document;
  type(p.window, d.getElementById("pState"), "lite"); await tick(); await tick();
  type(p.window, d.getElementById("pKind"), "job"); await tick();
  const seen = new Set();
  for (const age of ["16", "17"]) {
    for (const s of lite.states) {
      type(p.window, d.getElementById("pLite"), s.id);
      type(p.window, d.getElementById("pAge"), age);
      await tick(10);
      const card = d.querySelector("#pLiteCard");
      assert.ok(card, s.id + " at " + age + " shows a short card");
      const t = card.firstElementChild.textContent;
      const where = s.id + " at " + age;
      if (HOURS_NAME_16_AND_17.has(s.id)) {
        assert.match(t, STATE_ROW, where + " should take the state branch");
        assert.doesNotMatch(t, FEDERAL, where);
        assert.equal(d.querySelector("#pLiteNote"), null, where + " has no gap note");
      } else {
        assert.match(t, FEDERAL, where + " should take the federal branch");
        assert.doesNotMatch(t, STATE_ROW, where);
        assert.ok(d.querySelector("#pLiteNote"), where + " says what is not covered");
      }
      seen.add(s.id);
    }
  }
  assert.equal(seen.size, lite.states.length, "every lite state was checked");
  for (const id of HOURS_NAME_16_AND_17) assert.ok(lite.states.some((s) => s.id === id), id + " is a lite state");
});

test("p6-permit-1: one sentence must name both 16 and 17 (age 16 or older alone takes the federal branch)", async () => {
  const p = await loadPage("permit.html", {
    setup(w) {
      let real;
      Object.defineProperty(w, "fetch", {
        configurable: true,
        get: () => (u, i) => {
          if (!/states-lite\.json/.test(String(u))) return real(u, i);
          return real(u, i).then((r) => r.json()).then((j) => {
            j.states.find((s) => s.id === "ut").hours = "Age 16 or older needs a permit for this job. Ages 17 year olds may work 8 hours a day.";
            return new Response(JSON.stringify(j), { headers: { "Content-Type": "application/json" } });
          });
        },
        set: (f) => { real = f; },
      });
    },
  });
  await tick(); const d = p.document;
  type(p.window, d.getElementById("pState"), "lite"); await tick(); await tick();
  type(p.window, d.getElementById("pKind"), "job");
  type(p.window, d.getElementById("pLite"), "ut");
  type(p.window, d.getElementById("pAge"), "16");
  await tick(20);
  const t = d.querySelector("#pLiteCard").firstElementChild.textContent;
  assert.match(t, FEDERAL);
  assert.doesNotMatch(t, STATE_ROW);
});
test("p6-permit-1: Utah at 16 does not claim the page is silent", async () => {
  const out = await pick("ut", "16");
  assert.doesNotMatch(first(out).textContent, /Federal law sets no hour limits/);
  assert.match(first(out).textContent, /states limits for 16 and 17/);
  assert.equal(out.querySelector("#pLiteNote"), null);
});
test("p6-permit-1: under 14 points to Ages 12 to 14", async () => {
  const out = await pick("al", "13");
  assert.match(first(out).textContent, /^At your age \(13\):/);
  assert.ok(first(out).querySelector('a[href^="younger.html"]'));
});
test("p6-permit-1: 18 keeps the adult wording", async () => {
  const out = await pick("al", "18");
  assert.match(first(out).textContent, /^At your age \(18\): You are 18\. You do not need a minor work permit/);
  assert.ok(out.querySelector("#pAdultLine"));
});
