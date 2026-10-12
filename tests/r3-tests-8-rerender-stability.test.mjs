// Re-rendering must not pile up listeners or duplicate nodes. Find, Calendar and Playbook redraw lists after every change.
// A handler added on each redraw to a long-lived node (document, window, the results wrapper) would leak and fire many times.
// Here an interaction loop repeats and the listener count on document, window and the results box must not grow.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

// Counts net listeners per target: an add of a new (type, function, capture) triple counts once, a matching remove takes it off.
// Installed on EventTarget.prototype before any page script runs, so every target is seen.
function spy(w) {
  const log = new Map(); // target -> Set of "type|id|capture"
  const ids = new WeakMap();
  let n = 0;
  const idOf = (fn) => { if (!ids.has(fn)) ids.set(fn, ++n); return ids.get(fn); };
  const cap = (o) => (typeof o === "boolean" ? o : !!(o && o.capture));
  const proto = w.EventTarget.prototype, add = proto.addEventListener, rem = proto.removeEventListener;
  proto.addEventListener = function (t, fn, o) {
    if (fn) { if (!log.has(this)) log.set(this, new Set()); log.get(this).add(t + "|" + idOf(fn) + "|" + cap(o)); }
    return add.call(this, t, fn, o);
  };
  proto.removeEventListener = function (t, fn, o) {
    if (fn && log.has(this)) log.get(this).delete(t + "|" + idOf(fn) + "|" + cap(o));
    return rem.call(this, t, fn, o);
  };
  w.__net = (target) => (log.has(target) ? [...log.get(target)].map((k) => k.split("|")[0]).sort() : []);
}

// Listeners the test environment adds on its own, not the page: jsdom wires click, focus, focusin, keydown, keyup and the mouse
// events on the window, jsdom adds one load listener on the document, and dom-helper.mjs adds one load listener on the window.
const JSDOM_WINDOW = ["click", "focus", "focusin", "keydown", "keyup", "mousedown", "mouseout", "mouseover", "mouseup"];
const sorted = (a) => [...a].sort();

function noDupIds(document, where) {
  const seen = new Map();
  for (const e of document.querySelectorAll("[id]")) seen.set(e.id, (seen.get(e.id) || 0) + 1);
  const dup = [...seen].filter(([, n]) => n > 1).map(([id, n]) => id + " x" + n);
  assert.deepEqual(dup, [], where + ": duplicate ids " + dup.join(", "));
}

function tileFor(document, selId, text) {
  const wrap = document.getElementById(selId).nextElementSibling;
  const b = [...wrap.querySelectorAll("button.tile")].find((x) => x.textContent.trim() === text);
  assert.ok(b, "tile " + text + " for #" + selId);
  return b;
}

test("find: 30 rounds of place, age tile, search and More filters leave listeners, cards and ids unchanged", async () => {
  const { window, document, errors } = await loadPage("find.html", { setup: spy });
  const consoleErrors = [];
  const origErr = window.console.error;
  window.console.error = (...a) => { consoleErrors.push(a.join(" ")); };
  const out = document.getElementById("out");
  const sel = document.getElementById("place");
  assert.ok([...sel.options].some((o) => o.value === "city:davis"), "city:davis is offered");
  const q = document.getElementById("q");
  const more = () => document.getElementById("moreFilters");
  const snap = () => ({ doc: window.__net(document), win: window.__net(window), out: window.__net(out) });
  let first, firstCards = null;
  for (let r = 1; r <= 30; r++) {
    type(window, sel, "city:davis");
    await tick(30);
    tileFor(document, "age", "15").click();
    await tick(30);
    const cards = out.querySelectorAll("article.card.prog").length;
    if (firstCards === null) firstCards = cards;
    assert.equal(cards, firstCards, "round " + r + ": same result cards for the same filters");
    type(window, q, "park");
    await tick(220);
    type(window, q, "");
    await tick(220);
    more().open = true; more().dispatchEvent(new window.Event("toggle"));
    await tick(10);
    more().open = false; more().dispatchEvent(new window.Event("toggle"));
    tileFor(document, "age", "Any age").click();
    await tick(30);
    noDupIds(document, "find round " + r);
    if (r === 1) first = snap();
  }
  const last = snap();
  // Document: find.js one delegated click (stars and Show more); common.js one focusin (the menu closes when focus leaves it); jsdom one load.
  assert.deepEqual(last.doc, ["click", "focusin", "load"], "document: exact one-time listeners");
  // Window: common.js beforeprint and afterprint (open details, print one list), common.js load (tiles) and dom-helper load;
  // find.js hashchange and its own beforeprint (load the full text before printing); plus the jsdom ones.
  assert.deepEqual(last.win, sorted(["afterprint", "beforeprint", "beforeprint", "hashchange", "load", "load", ...JSDOM_WINDOW]), "window: exact one-time listeners");
  // Results box: find.js one toggle listener (a details opens, so load the full text). Cards use the document click, not their own.
  assert.deepEqual(last.out, ["toggle"], "results box: exact one-time listeners");
  window.console.error = origErr;
  assert.deepEqual(consoleErrors, [], "no console error: " + consoleErrors.join(" | "));
  assert.deepEqual(errors, [], "no page error: " + errors.join(" | "));
});

test("calendar: 10 rounds of month tiles leave listeners, cards and ids unchanged", async () => {
  const { window, document, errors } = await loadPage("calendar.html", { setup: spy });
  const consoleErrors = [];
  window.console.error = (...a) => { consoleErrors.push(a.join(" ")); };
  const months = document.getElementById("months");
  const snap = () => ({ doc: window.__net(document), win: window.__net(window), months: window.__net(months) });
  let first, base = null;
  for (let r = 1; r <= 10; r++) {
    const counts = [];
    for (const m of [3, 6, 9, 3]) {
      months.querySelector('.chip[data-m="' + m + '"]').click();
      await tick(10);
      counts.push(document.querySelectorAll("#cClose .card, #cOpen .card").length);
    }
    if (!base) base = counts;
    assert.deepEqual(counts, base, "round " + r + ": same cards for the same months");
    assert.equal(months.querySelectorAll(".chip").length, 12, "twelve month tiles, never more");
    noDupIds(document, "calendar round " + r);
    if (r === 1) first = snap();
  }
  const last = snap();
  assert.deepEqual(first.doc, last.doc, "document listeners after round 10 equal round 1");
  assert.deepEqual(first.win, last.win, "window listeners after round 10 equal round 1");
  assert.deepEqual(first.months, last.months, "month box listeners after round 10 equal round 1");
  // Months box: calendar.js one delegated click. Document: common.js one focusin (menu) and the jsdom load.
  // Window: common.js beforeprint, afterprint and load, dom-helper load, plus the jsdom ones. The "Next month" button gets its own click, but it is thrown away on each redraw.
  assert.deepEqual(last.months, ["click"], "months box: one delegated click");
  assert.deepEqual(last.doc, ["focusin", "load"], "document: exact one-time listeners");
  assert.deepEqual(last.win, sorted(["afterprint", "beforeprint", "load", "load", ...JSDOM_WINDOW]), "window: exact one-time listeners");
  assert.deepEqual(consoleErrors, [], "no console error: " + consoleErrors.join(" | "));
  assert.deepEqual(errors, [], "no page error: " + errors.join(" | "));
});

test("playbook: 10 rounds of adding people and clearing the map leave listeners, people and ids unchanged", async () => {
  const { window, document, errors } = await loadPage("playbook.html", { setup: spy });
  const consoleErrors = [];
  window.console.error = (...a) => { consoleErrors.push(a.join(" ")); };
  window.confirm = () => true;
  const box = document.getElementById("people");
  const snap = () => ({ doc: window.__net(document), win: window.__net(window), box: window.__net(box) });
  const people = () => box.querySelectorAll("article.person").length;
  const startN = people();
  assert.equal(startN, 5, "five people to start");
  let first;
  for (let r = 1; r <= 10; r++) {
    document.getElementById("addPerson").click();
    await tick(10);
    document.getElementById("addPerson").click();
    await tick(10);
    assert.equal(people(), startN + 2, "round " + r + ": two added");
    type(window, document.getElementById("pn0"), "Mrs. Lee");
    document.getElementById("clearMap").click(); // removes the added people and resets the map to five empty ones
    await tick(10);
    assert.equal(people(), startN, "round " + r + ": back to five");
    noDupIds(document, "playbook round " + r);
    if (r === 1) first = snap();
  }
  const last = snap();
  assert.deepEqual(first.doc, last.doc, "document listeners after round 10 equal round 1");
  assert.deepEqual(first.win, last.win, "window listeners after round 10 equal round 1");
  assert.deepEqual(first.box, last.box, "people box listeners after round 10 equal round 1");
  // One-time listeners: people box has delegated input, change and click (playbook.js); document has focusin only (common.js menu).
  assert.deepEqual(last.box, ["change", "click", "input"], "people box: three delegated listeners");
  // Document: common.js one focusin (menu) and the jsdom load. Window: common.js beforeprint, afterprint and load, dom-helper load, plus the jsdom ones.
  assert.deepEqual(last.doc, ["focusin", "load"], "document: exact one-time listeners");
  assert.deepEqual(last.win, sorted(["afterprint", "beforeprint", "load", "load", ...JSDOM_WINDOW]), "window: exact one-time listeners");
  assert.deepEqual(consoleErrors, [], "no console error: " + consoleErrors.join(" | "));
  assert.deepEqual(errors, [], "no page error: " + errors.join(" | "));
});
