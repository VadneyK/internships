import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, type, tick } from "./dom-helper.mjs";

const CAL = JSON.parse(fs.readFileSync(new URL("../data/calendar.json", import.meta.url), "utf8"));
const IDS = new Set(JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8")).map((e) => e.id));

test("calendar data: every item points at a real program, has months 1 to 12, and a quote that is on its card", () => {
  const entries = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
  const by = Object.fromEntries(entries.map((e) => [e.id, e]));
  const norm = (s) => String(s || "").replace(/’/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
  for (const it of CAL.items) {
    assert.ok(IDS.has(it.id), it.id + " is not a program");
    for (const k of ["opens", "closes"]) assert.ok(it[k] == null || (it[k] >= 1 && it[k] <= 12), it.id + " " + k);
    assert.ok(it.opens || it.closes);
    if (it.quote) assert.ok(norm(by[it.id].deadline_text + " " + (by[it.id].deadline_iso || "")).includes(norm(it.quote)), it.id + " quote is not on the card");
  }
});

test("calendar: loads clean, picks a month, filters by place and age, and links out safely", async () => {
  const p = await loadPage("calendar.html", { search: "?m=2" }); await tick(200);
  const { window, document } = p;
  assert.deepEqual(p.errors, []);
  assert.equal(document.querySelectorAll("#months .chip").length, 12);
  assert.equal(document.querySelector('#months .chip[aria-pressed="true"]').textContent, "Feb");
  const feb = document.querySelectorAll("#cClose li, #cOpen li").length;
  assert.ok(feb > 5, "February is a busy month for applications");
  type(window, document.getElementById("cPlace"), "area:midwest");
  const mid = document.querySelectorAll("#cClose li, #cOpen li").length;
  assert.ok(mid < feb);
  type(window, document.getElementById("cPlace"), "");
  type(window, document.getElementById("cAge"), "13");
  assert.ok(document.querySelectorAll("#cClose li, #cOpen li").length < feb);
  document.querySelector('#months .chip[data-m="8"]').click();
  assert.match(document.getElementById("cCount").textContent, /August/);
  for (const a of document.querySelectorAll("#cOpen a[target]")) assert.match(a.href, /^https:\/\//);
  assert.doesNotMatch(document.body.textContent, /undefined|NaN/);
});

test("calendar: a month with nothing says so and offers a way forward", async () => {
  const p = await loadPage("calendar.html", { search: "?m=7&at=city:san-diego" }); await tick(200);
  const n = p.document.querySelectorAll("#cClose li, #cOpen li").length;
  if (n === 0) assert.equal(p.document.getElementById("cNone").hidden, false);
  else assert.equal(p.document.getElementById("cNone").hidden, true);
});
