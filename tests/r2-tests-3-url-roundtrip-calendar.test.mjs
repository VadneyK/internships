// Ticket r2-tests-3: share-link round trip. A state a teen can reach, written to the address bar and opened fresh,
// must restore the same controls and the same cards. This file covers Calendar.
// A failure prints the state and the URL. Seeded PRNG, so a failure repeats.
// Run with: node --test tests/r2-tests-3-url-roundtrip-calendar.test.mjs
// One third of the former r2-tests-3-url-roundtrip.test.mjs, split so CI shards stay even.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const pressed = (el) => el.getAttribute("aria-pressed") === "true";
const show = (o) => JSON.stringify(o);

// Run fn over items, a few at a time (each item loads a page in jsdom).
async function pool(items, size, fn) {
  let i = 0;
  const workers = Array.from({ length: size }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k], k); }
  });
  await Promise.all(workers);
}

/* ---------------- Calendar ---------------- */
test("calendar: every month, with and without at and age, reloads to the same page", { timeout: 600000 }, async () => {
  const probe = await loadPage("calendar.html");
  for (let i = 0; i < 100 && probe.document.getElementById("cPlace").options.length < 2; i++) await tick(50);
  const placeOpts = [...probe.document.getElementById("cPlace").options].map((o) => o.value).filter(Boolean);
  probe.window.close();
  assert.ok(placeOpts.length > 5);
  const at = placeOpts.find((v) => v === "city:oakland") || placeOpts[0];
  const age = "15";

  const view = (d) => ({
    place: d.getElementById("cPlace").value, age: d.getElementById("cAge").value,
    month: [...d.querySelectorAll("#months .chip")].map((b) => b.getAttribute("data-m") + ":" + pressed(b) + ":" + b.getAttribute("aria-label")),
    count: d.getElementById("cCount").textContent,
    close: [...d.querySelectorAll("#cClose li h3")].map((h) => h.textContent), open: [...d.querySelectorAll("#cOpen li h3")].map((h) => h.textContent),
  });
  const variants = [{}, { at }, { age }, { at, age }];
  const jobs = [];
  for (let m = 1; m <= 12; m++) for (const v of variants) jobs.push({ m, ...v });

  await pool(jobs, 4, async (j) => {
    const label = "calendar " + show(j);
    const p = await loadPage("calendar.html");
    let search, before;
    try {
      const { window: w, document: d } = p;
      for (let i = 0; i < 100 && !d.querySelector("#months .chip"); i++) await tick(50);
      d.querySelector('#months .chip[data-m="' + j.m + '"]').click();
      for (const [id, v] of [["cPlace", j.at], ["cAge", j.age]]) if (v) { d.getElementById(id).value = v; d.getElementById(id).dispatchEvent(new w.Event("change", { bubbles: true })); }
      search = w.location.search; before = view(d);
      const expect = new w.URLSearchParams(); expect.set("m", String(j.m)); if (j.at) expect.set("at", j.at); if (j.age) expect.set("age", j.age);
      assert.equal(search, "?" + expect.toString(), label + " URL " + search);
      assert.deepEqual(Object.keys(Object.fromEntries(new w.URLSearchParams(search))), ["m", ...(j.at ? ["at"] : []), ...(j.age ? ["age"] : [])], label);
    } finally { p.window.close(); }
    const p2 = await loadPage("calendar.html", { search });
    try {
      for (let i = 0; i < 100 && !p2.document.querySelector("#months .chip"); i++) await tick(50);
      assert.deepEqual(view(p2.document), before, label + " URL " + search);
      assert.equal(p2.window.location.search, search, label + " reload rewrote URL " + search);
    } finally { p2.window.close(); }
  });
});
