// Ticket p8-paycheck-other: "Another state" on the paycheck page shows that state's minimum wage
// (from data/state-wages.json) plus the federal Social Security and Medicare lines.
// Run with: node --test tests/p8-paycheck-other.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const wages = JSON.parse(fs.readFileSync(path.join(root, "data/state-wages.json"), "utf8"));
const money = JSON.parse(fs.readFileSync(path.join(root, "data/money.json"), "utf8"));
const TAX = "Ask your employer if your state also holds back state income tax, and for the state form if it does.";
const byId = (id) => wages.states.find((s) => s.id === id);

async function pickOther(page) {
  const { window, document } = page;
  type(window, document.getElementById("mPreset"), "other");
  await tick(150);
  return document;
}

test("paycheck: Nebraska shows its wage text, source link and the federal lines", async () => {
  const page = await loadPage("paycheck.html"); await tick(200);
  const document = await pickOther(page);
  const box = document.getElementById("mOtherBox");
  assert.equal(box.hidden, false);
  type(page.window, document.getElementById("mOtherState"), "ne");
  await tick(50);
  const ne = byId("ne");
  const out = document.getElementById("mOtherWage");
  assert.ok(out.textContent.includes(ne.wage), "wage text");
  assert.ok(out.textContent.includes(ne.youth), "youth text");
  const link = [...out.querySelectorAll("a")].find((a) => a.getAttribute("href") === ne.url);
  assert.ok(link, "source link");
  assert.ok(link.textContent.startsWith(ne.page_title));
  assert.ok(out.textContent.includes(money.lineNotes.ss), "Social Security line");
  assert.ok(out.textContent.includes(money.lineNotes.medicare), "Medicare line");
  assert.ok(out.textContent.includes(TAX), "state tax line");
  assert.doesNotMatch(out.textContent, /state (income )?tax (rate|is) \d|\d+(\.\d+)? percent state/i);
  assert.deepEqual(page.errors, []);
});

test("paycheck: every state in state-wages.json can be picked and shows its own wage", async () => {
  const page = await loadPage("paycheck.html"); await tick(200);
  const document = await pickOther(page);
  const sel = document.getElementById("mOtherState");
  const ids = [...sel.options].map((o) => o.value).filter(Boolean);
  assert.deepEqual([...ids].sort(), wages.states.map((s) => s.id).sort());
  for (const id of ["tx", "dc", "al"]) {
    type(page.window, sel, id); await tick(20);
    assert.ok(document.getElementById("mOtherWage").textContent.includes(byId(id).wage), id);
  }
});

test("paycheck: the estimate still works with Another state and a typed rate", async () => {
  const page = await loadPage("paycheck.html"); await tick(200);
  const document = await pickOther(page);
  type(page.window, document.getElementById("mOtherState"), "ne"); await tick(30);
  type(page.window, document.getElementById("mWage"), "10");
  type(page.window, document.getElementById("mHours"), "10");
  const rows = [...document.querySelectorAll("#mOut tbody tr")].map((r) => r.textContent);
  assert.match(rows[0], /\$100\.00/);
  assert.ok(rows.some((r) => /Social Security/.test(r)) && rows.some((r) => /Medicare/.test(r)));
});

test("paycheck: California is unchanged and hides the other-state box", async () => {
  const page = await loadPage("paycheck.html"); await tick(200);
  const { window, document } = page;
  type(window, document.getElementById("mPreset"), "other"); await tick(100);
  type(window, document.getElementById("mPreset"), "ca"); await tick(30);
  assert.equal(document.getElementById("mOtherBox").hidden, true);
  assert.equal(document.getElementById("mOther").hidden, true);
  assert.equal(document.getElementById("mWage").value, "16.90");
  assert.match(document.getElementById("mOut").textContent, /California State Disability Insurance/);
  assert.doesNotMatch(document.getElementById("mOtherWage").textContent, /Nebraska/);
  assert.deepEqual(page.errors, []);
});

test("paycheck: first load does not read state-wages.json", async () => {
  const page = await loadPage("paycheck.html"); await tick(200);
  assert.equal(page.document.getElementById("mOtherBox").hidden, true);
  assert.equal(page.document.getElementById("mOtherState").options.length, 1);
});

test("paycheck: no dash characters in the new page text", async () => {
  const page = await loadPage("paycheck.html"); await tick(200);
  const document = await pickOther(page);
  type(page.window, document.getElementById("mOtherState"), "tx"); await tick(30);
  assert.doesNotMatch(document.getElementById("mOtherBox").textContent, /[\u2013\u2014]/);
});

// The wage block (links and long text) is not a live region. The short line in #mStatus (role=status) carries each state change.
test("paycheck: picking a state puts a short line in the live status region", async () => {
  const page = await loadPage("paycheck.html"); await tick(200);
  const document = await pickOther(page);
  await tick(600); // let the estimate announce timer (500 ms) fire first
  const st = document.getElementById("mStatus");
  assert.equal(st.getAttribute("role"), "status", "#mStatus is not role=status");
  assert.ok(!st.closest("[hidden]"), "#mStatus is hidden");
  type(page.window, document.getElementById("mOtherState"), "ne"); await tick(50);
  assert.equal(st.textContent, "Showing the minimum wage for Nebraska.");
  assert.equal(document.getElementById("mOtherWage").getAttribute("role"), null, "wage block should not be a live region");
  type(page.window, document.getElementById("mOtherState"), "tx"); await tick(30);
  assert.equal(st.textContent, "Showing the minimum wage for Texas.");
  assert.deepEqual(page.errors, []);
});

test("paycheck: a failed state wage load is said in the live status region and on the page", async () => {
  const page = await loadPage("paycheck.html", {
    setup(w) {
      let wrapped;
      Object.defineProperty(w, "fetch", {
        configurable: true, enumerable: true,
        get: () => wrapped,
        set: (real) => {
          wrapped = (u, o) => {
            const p = new URL(String(u), w.location.href).pathname;
            if (p.endsWith("/data/state-wages.json")) return Promise.reject(new TypeError("network down"));
            return real(u, o);
          };
        },
      });
    },
  });
  await tick(200);
  const document = await pickOther(page);
  await tick(100);
  const st = document.getElementById("mStatus");
  assert.equal(st.getAttribute("role"), "status");
  assert.match(st.textContent, /could not load/i);
  assert.match(document.getElementById("mOtherWage").textContent, /could not load/i);
  assert.deepEqual(page.errors, []);
});
