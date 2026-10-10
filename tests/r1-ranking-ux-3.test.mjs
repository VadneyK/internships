// "Good fit for you" strip above the results (ticket r1-ranking-ux-3).
// Run with: node --test tests/r1-ranking-ux-3.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));
const OK = ["open-now", "opens-soon", "rolling", "year-round"];
const NUDGE = "Pick your age and area to see programs picked for you.";
const LINE = "Picked from your age and area. Dates and rules can change, so check the official page.";

const items = (doc) => [...doc.querySelectorAll("#picks ol li")];
const names = (doc) => items(doc).map((li) => li.querySelector("b").textContent);

test("(a) topPicks never returns fee-based, closed or unconfirmed entries and respects n and age", () => {
  const t = Date.now();
  const filtered = DATA.filter((e) => L.matches(e, { age: "15" }, t));
  for (const n of [0, 1, 3, 5]) {
    const out = L.topPicks(filtered, { age: "15" }, t, n);
    assert.ok(out.length <= n);
    for (const e of out) {
      assert.notEqual(e.paid_type, "fee-based");
      assert.ok(OK.includes(L.effStatus(e, t)), e.id + " has status " + L.effStatus(e, t));
      assert.ok(e.min_age != null || e.max_age != null, e.id + " has no stated ages");
      assert.ok(e.min_age == null || e.min_age <= 15);
      assert.ok(e.max_age == null || e.max_age >= 15);
    }
  }
  assert.equal(L.topPicks(filtered, { age: "15" }, t, 3).length, 3);
  // made-up entries: each one breaks exactly one rule
  const base = { id: "x", name: "X", status: "open-now", paid_type: "paid", min_age: 14, max_age: 17, priority: 3 };
  const bad = [
    Object.assign({}, base, { id: "fee", paid_type: "fee-based" }),
    Object.assign({}, base, { id: "closed", status: "closed-expect-reopen" }),
    Object.assign({}, base, { id: "unconf", status: "unconfirmed" }),
    Object.assign({}, base, { id: "event", status: "event" }),
    Object.assign({}, base, { id: "min16", min_age: 16, max_age: null }),
    Object.assign({}, base, { id: "noage", min_age: null, max_age: null }),
    Object.assign({}, base, { id: "expired", deadline_iso: "2020-01-01" }),
  ];
  const good = Object.assign({}, base, { id: "good", name: "Good" });
  assert.deepEqual(L.topPicks(bad.concat([good]), { age: 15 }, t, 3).map((e) => e.id), ["good"]);
  // without an age the stated-age rule is not applied
  assert.ok(L.topPicks([bad[5]], {}, t, 3).length === 1);
  assert.deepEqual(L.topPicks([], {}, t, 3), []);
});

test("(b) with an age and a city the strip shows 1 to 3 picks and See card opens the card", async () => {
  const { document, window, errors } = await loadPage("find.html", { search: "?age=15&at=city:berkeley" });
  const box = document.getElementById("picks");
  assert.equal(box.hidden, false);
  assert.equal(document.getElementById("picksNudge").hidden, true);
  const lis = items(document);
  assert.ok(lis.length >= 1 && lis.length <= 3, "got " + lis.length);
  assert.ok(box.textContent.includes(LINE));
  for (const li of lis) {
    assert.ok(li.querySelector(".tag"), "status tag");
    assert.ok(/Dates:/.test(li.textContent), "deadline line");
    assert.ok(li.querySelector("a[data-jump]").textContent === "See card");
  }
  for (const name of names(document)) {
    const i = names(document).indexOf(name);
    const link = items(document)[i].querySelector("a[data-jump]");
    const id = link.getAttribute("data-jump");
    link.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await tick();
    const card = document.getElementById("p-" + id);
    assert.ok(card, "card for " + name);
    assert.equal(card.querySelector("h3").textContent, name);
  }
  assert.deepEqual(errors, []);
});

test("(c) with no age and no place the strip is hidden and the nudge shows", async () => {
  const { document, errors } = await loadPage("find.html");
  assert.equal(document.getElementById("picks").hidden, true);
  assert.equal(items(document).length, 0);
  const nudge = document.getElementById("picksNudge");
  assert.equal(nudge.hidden, false);
  assert.equal(nudge.textContent.trim(), NUDGE);
  assert.deepEqual(errors, []);
});

test("(d) a search that matches nothing leaves the strip unchanged, and See card still finds the card", async () => {
  const { document, window, errors } = await loadPage("find.html", { search: "?age=15&at=city:berkeley" });
  const before = document.getElementById("picks").innerHTML;
  type(window, document.getElementById("q"), "zzzqqqxxnomatch");
  await tick(400);
  assert.ok(document.querySelector("#out .empty"), "list should be empty");
  assert.equal(document.getElementById("picks").hidden, false);
  assert.equal(document.getElementById("picks").innerHTML, before);
  const link = document.querySelector("#picks a[data-jump]");
  const id = link.getAttribute("data-jump");
  link.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await tick();
  assert.ok(document.getElementById("p-" + id), "card is shown after See card");
  assert.deepEqual(errors, []);
});

test("(e) the strip has a heading, no duplicate ids and no errors", async () => {
  const { document, errors } = await loadPage("find.html", { search: "?age=15&at=city:berkeley" });
  const h = document.querySelector("#picks h2");
  assert.equal(h.textContent.trim(), "Good fit for you");
  const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
  assert.deepEqual(ids.filter((v, i) => ids.indexOf(v) !== i), []);
  assert.deepEqual(errors, []);
});
