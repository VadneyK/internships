// Ticket r2-tests-3: share-link round trip. A state a teen can reach, written to the address bar and opened fresh,
// must restore the same controls and the same cards. This file covers Permit.
// A failure prints the state and the URL. Seeded PRNG, so a failure repeats.
// Run with: node --test tests/r2-tests-3-url-roundtrip-permit.test.mjs
// One third of the former r2-tests-3-url-roundtrip.test.mjs, split so CI shards stay even.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const show = (o) => JSON.stringify(o);

// Run fn over items, a few at a time (each item loads a page in jsdom).
async function pool(items, size, fn) {
  let i = 0;
  const workers = Array.from({ length: size }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k], k); }
  });
  await Promise.all(workers);
}

/* ---------------- Permit ---------------- */
test("permit: every state x age x kind reloads to the same answer", { timeout: 900000 }, async () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "permits.json"), "utf8"));
  const states = Object.keys(data.states);
  const kinds = data.kinds.map((k) => k[0]);
  const ages = ["12", "13", "14", "15", "16", "17", "18"];
  assert.ok(states.length >= 17 && kinds.length >= 8);

  const answer = (d) => { const h = d.getElementById("pOut").querySelector("h2"); return h ? h.textContent : d.getElementById("pOut").textContent.trim(); };
  const sel = (d) => ["pState", "pAge", "pKind"].map((id) => d.getElementById(id).value);

  // One live page per state: drive the three selects, read the URL and the answer.
  const combos = [];
  await pool(states, 4, async (st) => {
    const p = await loadPage("permit.html");
    try {
      const { window: w, document: d } = p;
      for (let i = 0; i < 100 && d.getElementById("pKind").options.length < 2; i++) await tick(50);
      const set = (id, v) => { d.getElementById(id).value = v; d.getElementById(id).dispatchEvent(new w.Event("change", { bubbles: true })); };
      for (const age of ages) for (const kind of kinds) {
        set("pState", st); set("pAge", age); set("pKind", kind);
        const search = w.location.search;
        const expect = "?state=" + st + "&age=" + age + "&kind=" + kind;
        assert.equal(search, expect, "permit URL for " + show({ st, age, kind }));
        combos.push({ st, age, kind, search, head: answer(d) });
      }
    } finally { p.window.close(); }
  });
  // Partial states: only some selects chosen never write an empty key.
  const part = await loadPage("permit.html");
  try {
    const d = part.document;
    for (let i = 0; i < 100 && d.getElementById("pKind").options.length < 2; i++) await tick(50);
    d.getElementById("pAge").value = "15"; d.getElementById("pAge").dispatchEvent(new part.window.Event("change", { bubbles: true }));
    assert.equal(part.window.location.search, "?age=15");
  } finally { part.window.close(); }

  await pool(combos, 8, async (c) => {
    const p = await loadPage("permit.html", { search: c.search });
    try {
      for (let i = 0; i < 100 && p.document.getElementById("pKind").options.length < 2; i++) await tick(50);
      await tick(10);
      assert.deepEqual(sel(p.document), [c.st, c.age, c.kind], "permit selects " + show(c) + " URL " + c.search);
      assert.equal(answer(p.document), c.head, "permit headline " + show(c) + " URL " + c.search);
      assert.equal(p.window.location.search, c.search, "permit reload rewrote URL " + c.search);
    } finally { p.window.close(); }
  });
});
