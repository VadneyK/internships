import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadPage, tick } from "./dom-helper.mjs";
const require = createRequire(import.meta.url);
const L = require("../assets/js/lib.js");

const goal = (d, k) => d.querySelector('#goalChips [data-goal="' + k + '"]');
const on = (d, k) => goal(d, k).getAttribute("aria-pressed") === "true";
const dash = /[\u2013\u2014]/;

test("r5-find-2: four goal chips sit above the filters", async () => {
  const { document } = await loadPage("find.html"); await tick(150);
  const g = document.getElementById("goalChips");
  assert.deepEqual([...g.querySelectorAll(".chip")].map((b) => b.textContent), ["Volunteering", "Paid job or paid program", "Research", "College classes"]);
  assert.ok(g.compareDocumentPosition(document.getElementById("q")) & 4, "goals come before search");
  assert.equal(dash.test(g.textContent), false);
});

test("r5-find-2: Volunteering sets the Kind chip, shows only volunteer cards, and a second tap clears it", async () => {
  const { window, document } = await loadPage("find.html"); await tick(150);
  goal(document, "volunteer").click(); await tick(100);
  assert.equal(on(document, "volunteer"), true);
  assert.equal(document.querySelector('#typeChips [data-val="volunteer"]').getAttribute("aria-pressed"), "true");
  assert.match(window.location.search, /kind=volunteer/);
  const tags = [...document.querySelectorAll("#out article.prog")].map((a) => a.querySelector(".row .tag.ghost:last-child, .row").textContent);
  assert.ok(tags.length > 0 && tags.every((t) => /Volunteer/.test(t)));
  goal(document, "volunteer").click(); await tick(100);
  assert.equal(on(document, "volunteer"), false);
  assert.equal(window.location.search.includes("kind="), false);
});

test("r5-find-2: Paid sets the Pay filter, Research and College classes set Kind, and goals replace each other", async () => {
  const { window, document } = await loadPage("find.html"); await tick(150);
  goal(document, "paid").click(); await tick(100);
  assert.match(window.location.search, /pay=pay/);
  assert.equal(document.querySelector('#paidChips [data-val="pay"]').getAttribute("aria-pressed"), "true");
  goal(document, "research").click(); await tick(100);
  assert.match(window.location.search, /kind=research/);
  assert.equal(window.location.search.includes("pay="), false);
  assert.equal(on(document, "paid"), false);
  goal(document, "college").click(); await tick(100);
  assert.match(window.location.search, /kind=pre-college/);
  assert.equal(on(document, "college"), true);
  assert.equal(on(document, "research"), false);
});

test("r5-find-2: a goal shows as chosen when the address already holds its filter, and Clear all turns it off", async () => {
  const { document } = await loadPage("find.html?kind=volunteer"); await tick(150);
  assert.equal(on(document, "volunteer"), true);
  document.getElementById("reset").click(); await tick(100);
  assert.equal(on(document, "volunteer"), false);
});

/* Every place today has listings, so the test removes Ohio's from the lite file the page reads. */
function noOhio(w) {
  let inner;
  Object.defineProperty(w, "fetch", {
    configurable: true,
    set(v) { inner = v; },
    get() {
      return (u, o) => inner(u, o).then(async (r) => {
        if (!/entries-lite\.json/.test(String(u))) return r;
        const rows = (await r.json()).filter((e) => !L.matches(e, { place: "state:ohio" }, Date.now()));
        return { ok: true, status: 200, json: async () => rows };
      });
    },
  });
}

test("r5-find-2: a place with no listings gets the no listings card with three steps and the statewide button", async () => {
  const { document } = await loadPage("find.html?at=state:ohio", { setup: noOhio }); await tick(200);
  const box = document.getElementById("townHelp");
  assert.equal(box.hidden, false);
  assert.match(box.querySelector("h2").textContent, /^We have no listings for this place yet$/);
  const items = [...box.querySelectorAll("ol li")];
  assert.equal(items.length, 3);
  assert.deepEqual([...box.querySelectorAll("ol a")].map((a) => a.getAttribute("href")), ["jobs.html", "permit.html"]);
  assert.match(items[2].textContent, /school counselor/);
  assert.equal(dash.test(box.textContent), false);
  const btn = document.getElementById("townMore");
  assert.ok(btn && /statewide and online programs/.test(btn.textContent));
  btn.click(); await tick(100);
  assert.match(document.getElementById("townHelp").textContent, /Online and national programs are included/);
  assert.ok(document.querySelectorAll("#out article.prog").length > 0);
});

test("r5-find-2: a place that has listings keeps the old help card, not the no listings card", async () => {
  const { document } = await loadPage("find.html?at=state:ohio&age=12&when=open"); await tick(150);
  const box = document.getElementById("townHelp");
  if (!box.hidden) assert.doesNotMatch(box.textContent, /no listings for this place/);
});
