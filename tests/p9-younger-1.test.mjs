// p9-younger-1: Ages 12 to 14 page. A state with a full answer in data/permits.json (not CA, GA, NY or IL, and not BC)
// is in the picker, and its card shows: the name, "Full work permit answer" linked to permit.html?state=<id>&age=<age>
// (the picked age or 14), the hours at 14 and the state wage from the same helpers the jobs page uses, and the under-14 line.
// Run with: node --test tests/p9-younger-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const permits = read("data/permits.json");
const wages = read("data/state-wages.json");
const FOUR = ["ca", "ga", "ny", "il"];
const PERMIT_ONLY = Object.keys(permits.states).filter((id) => !FOUR.includes(id) && id !== "bc");
const UNDER14 = "Under 14 rules for this state are not on this page. Ask the state labor office or see the permit finder.";
const DASHES = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
const wageRow = (id) => wages.states.find((s) => s.id === id);

function pick(window, document, v) {
  const s = document.getElementById("yState");
  s.value = v;
  s.dispatchEvent(new window.Event("change", { bubbles: true }));
}
// The card fills after permits.json and state-wages.json arrive; a slow machine needs longer.
async function waitFor(box, pred) {
  for (let i = 0; i < 120 && !pred(box); i++) await tick(25);
}
const hasHours = (box, id) => box.textContent.includes(permits.states[id].hours["14"]);
const hasWage = (box, id) => box.textContent.includes(wageRow(id).wage);

test("p9-younger-1: the picker lists each permit-only state once, by its permits.json name, and never British Columbia", async () => {
  const { document, errors } = await loadPage("younger.html"); await tick(150);
  assert.deepEqual(errors, []);
  const opts = [...document.getElementById("yState").options];
  const values = opts.map((o) => o.value);
  assert.equal(new Set(values).size, values.length, "no option value is repeated");
  assert.equal(values.includes("bc"), false, "British Columbia is not in the picker");
  for (const id of PERMIT_ONLY) {
    const hits = opts.filter((o) => o.value === id);
    assert.equal(hits.length, 1, `${id} is in the picker once`);
    assert.equal(hits[0].textContent, permits.states[id].name, `${id} label matches permits.json`);
  }
  for (const id of FOUR) assert.equal(opts.filter((o) => o.value === id).length, 1, `${id} is still one option`);
  assert.deepEqual(opts.slice(1, 5).map((o) => o.value), ["ca", "ga", "ny", "il"], "the four full states still come first");
  const names = opts.slice(5).map((o) => o.textContent);
  const sorted = [...names].sort((a, b) => (a < b ? -1 : 1));
  assert.deepEqual(names, sorted, "states after the four are in name order");
});

test("p9-younger-1: first load does not read permits.json, states-lite.json or state-wages.json", async () => {
  const fetchLog = [];
  const { document, errors } = await loadPage("younger.html", { fetchLog }); await tick(200);
  assert.deepEqual(errors, []);
  assert.ok(document.getElementById("yState"));
  const bad = fetchLog.filter((f) => /permits\.json|states-lite\.json|state-wages\.json/.test(f.url));
  assert.deepEqual(bad, [], "no permit, lite or wage file on first load");
});

test("p9-younger-1: Texas shows its card with the name, the full answer link, hours at 14, the wage and the under-14 line", async () => {
  const fetchLog = [];
  const { document, window, errors } = await loadPage("younger.html", { fetchLog }); await tick(150);
  pick(window, document, "tx");
  const box = document.getElementById("otherLite");
  assert.equal(box.hidden, false, "the card is shown");
  assert.equal(box.querySelector("h3").textContent, "Texas");
  const link = box.querySelector('a[href="permit.html?state=tx&age=14"]');
  assert.ok(link, "the link goes to permit.html?state=tx&age=14");
  assert.equal(link.textContent, "Full work permit answer");
  assert.ok(box.textContent.includes(UNDER14), "the under-14 line is shown as written");
  await waitFor(box, (b) => hasHours(b, "tx") && hasWage(b, "tx"));
  assert.ok(hasHours(box, "tx"), "the hours at 14 come from permits.json through permitFor");
  assert.ok(box.textContent.includes("Hours in Texas at 14."), "the hours line names the state and age");
  assert.ok(hasWage(box, "tx"), "the wage comes from state-wages.json through G.wageLine");
  assert.match(box.innerHTML, /stateWage/, "the wage line uses the shared wage markup");
  assert.doesNotMatch(box.textContent, /undefined|NaN/);
  assert.doesNotMatch(box.textContent, DASHES);
  assert.deepEqual(errors, []);
  assert.equal(fetchLog.filter((f) => /states-lite\.json/.test(f.url)).length, 0, "the short-answer file is not read for Texas");
  assert.ok(fetchLog.some((f) => /permits\.json/.test(f.url)), "permits.json is read after the pick");
});

test("p9-younger-1: Minnesota with ?age=13 links with age 13 and shows its own hours and wage", async () => {
  const { document, errors } = await loadPage("younger.html", { search: "?state=mn&age=13" }); await tick(150);
  assert.deepEqual(errors, []);
  assert.equal(document.getElementById("yState").value, "mn");
  const box = document.getElementById("otherLite");
  assert.equal(box.hidden, false);
  assert.equal(box.querySelector("h3").textContent, "Minnesota");
  assert.ok(box.querySelector('a[href="permit.html?state=mn&age=13"]'), "the link carries the picked age 13");
  await waitFor(box, (b) => hasHours(b, "mn") && hasWage(b, "mn"));
  assert.ok(hasHours(box, "mn"), "Minnesota hours at 14");
  assert.ok(hasWage(box, "mn"), "Minnesota wage row");
  assert.ok(box.textContent.includes(UNDER14));
});

test("p9-younger-1: Minnesota with no age in the address or the saved Programs age links with age 14", async () => {
  const { document, window } = await loadPage("younger.html"); await tick(150);
  pick(window, document, "mn");
  const box = document.getElementById("otherLite");
  assert.ok(box.querySelector('a[href="permit.html?state=mn&age=14"]'), "age 14 by default");
  await waitFor(box, (b) => hasHours(b, "mn"));
  assert.ok(hasHours(box, "mn"));
});

test("p9-younger-1: the status line names a permit-only state and points to its answer below the picker", async () => {
  const { document, window } = await loadPage("younger.html"); await tick(150);
  pick(window, document, "tx");
  const st = document.getElementById("yStatus");
  assert.match(st.textContent, /Texas/);
  assert.match(st.textContent, /work permit answer/);
  assert.doesNotMatch(st.textContent, DASHES);
});

test("p9-younger-1: a full state hides the card, and changing from Texas to California hides it too", async () => {
  const { document, window } = await loadPage("younger.html"); await tick(150);
  const box = document.getElementById("otherLite");
  pick(window, document, "tx"); await tick(60);
  assert.equal(box.hidden, false);
  pick(window, document, "ca"); await tick(40);
  assert.equal(box.hidden, true, "California has its own full answer");
  assert.equal(box.innerHTML, "");
  pick(window, document, "tx"); await tick(40);
  pick(window, document, ""); await tick(40);
  assert.equal(box.hidden, true, "All four states hides the card");
});

test("p9-younger-1: an unknown state id still shows no card", async () => {
  const { document } = await loadPage("younger.html", { search: "?state=bc" }); await tick(150);
  assert.equal(document.getElementById("yState").value, "", "BC is not an option, so the picker stays on All four states");
  assert.equal(document.getElementById("otherLite").hidden, true);
});

// Holds every request for a URL that matches re until release() is called, then sends it on as usual.
function gateFetch(window, re) {
  const orig = window.fetch;
  let release;
  const open = new Promise((r) => (release = r));
  window.fetch = (u, o) => (re.test(String(u)) ? open.then(() => orig(u, o)) : orig(u, o));
  return () => release();
}
// Makes every request for a URL that matches re fail: as a 500 answer, or as a network error.
function failFetch(window, re, mode) {
  const orig = window.fetch;
  window.fetch = (u, o) => {
    if (!re.test(String(u))) return orig(u, o);
    return mode === "500" ? Promise.resolve(new Response("error", { status: 500 })) : Promise.reject(new TypeError("Failed to fetch"));
  };
}

test("p9-younger-1: every permit-only state's card names it from permits.json, links it, and shows its own hours at 14", async () => {
  const { document, window, errors } = await loadPage("younger.html"); await tick(150);
  const box = document.getElementById("otherLite");
  for (const id of PERMIT_ONLY) {
    const name = permits.states[id].name;
    pick(window, document, id);
    await waitFor(box, (b) => hasHours(b, id));
    assert.equal(box.hidden, false, `${id} card is shown`);
    assert.equal(box.querySelector("h3").textContent, name, `${id} heading is the permits.json name`);
    assert.ok(box.querySelector(`a[href="permit.html?state=${id}&age=14"]`), `${id} links to its full answer at 14`);
    assert.ok(hasHours(box, id), `${id} hours text is the permits.json hours at 14`);
    assert.ok(box.textContent.includes("Hours in " + name + " at 14."), `${id} hours line names the state`);
    assert.doesNotMatch(box.textContent, /undefined|NaN/);
  }
  assert.deepEqual(errors, []);
});

test("p9-younger-1: a quick switch from Texas to Minnesota shows only Minnesota, even when permits.json arrives late", async () => {
  const { document, window, errors } = await loadPage("younger.html"); await tick(150);
  const release = gateFetch(window, /permits\.json/);
  pick(window, document, "tx"); await tick(40);
  pick(window, document, "mn"); await tick(40);
  release();
  const box = document.getElementById("otherLite");
  await waitFor(box, (b) => hasHours(b, "mn"));
  await tick(150);
  assert.equal(box.querySelector("h3").textContent, "Minnesota");
  assert.ok(hasHours(box, "mn"), "Minnesota hours are shown");
  assert.equal(box.textContent.includes("Texas"), false, "no Texas text is left in the card");
  assert.equal(box.textContent.includes(permits.states.tx.hours["14"]), false, "no Texas hours are left in the card");
  assert.ok(box.querySelector('a[href="permit.html?state=mn&age=14"]'), "the link is Minnesota's");
  assert.deepEqual(errors, []);
});

for (const mode of ["500", "network"]) {
  test(`p9-younger-1: when permits.json fails (${mode}), the card says the hours could not load and keeps the link and the wage`, async () => {
    const { document, window, errors } = await loadPage("younger.html"); await tick(150);
    failFetch(window, /permits\.json/, mode);
    pick(window, document, "tx");
    const box = document.getElementById("otherLite");
    await waitFor(box, (b) => b.textContent.includes("could not load"));
    await waitFor(box, (b) => hasWage(b, "tx"));
    assert.equal(box.hidden, false, "the card is still shown");
    assert.ok(box.textContent.includes("The hours rule could not load. Use the work permit finder link."), "the failure message is shown");
    assert.equal(box.textContent.includes("Hours in Texas at 14."), false, "no hours line is made up");
    assert.ok(box.querySelector('a[href="permit.html?state=tx&age=14"]'), "the full answer link is still there");
    assert.ok(hasWage(box, "tx"), "the wage line still loads");
    assert.deepEqual(errors, []);
  });
}
