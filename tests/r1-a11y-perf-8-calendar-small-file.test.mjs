// Calendar loads only calendar.json and the small calendar file, never the 1 MB card file.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage } from "./dom-helper.mjs";

const read = (f) => JSON.parse(fs.readFileSync(new URL("../data/" + f, import.meta.url), "utf8"));
const CARD_KEYS = ["id", "name", "org", "city", "url", "paid_type", "type", "fields", "grades", "needs_work_permit", "verified", "priority",
  "deadline_confidence", "min_age", "max_age", "status", "deadline_iso", "opens_iso", "regions", "season"];
// The card rows are no longer a file; they are rebuilt here from entries.json the way tools/build_data.py builds the calendar file.
const cardRows = () => read("entries.json").map((d) => Object.fromEntries(CARD_KEYS.filter((k) => k in d).map((k) => [k, d[k]])));
const NOW = Date.UTC(2026, 9, 10, 12);

test("calendar.html fetches only calendar.json and entries-cal.json, under 150000 bytes", async () => {
  const seen = [];
  const { window } = await loadPage("calendar.html", { fetchLog: seen, now: NOW });
  const paths = [...new Set(seen.map((r) => new URL(r.url).pathname.replace(/^\//, "")).filter((p) => p.startsWith("data/")))].sort();
  assert.deepEqual(paths, ["data/calendar.json", "data/entries-cal.json"]);
  const bytes = paths.reduce((n, p) => n + fs.statSync(new URL("../" + p, import.meta.url)).size, 0);
  assert.ok(bytes < 150000, "bytes " + bytes);
  window.close();
});

test("entries-cal.json is the card rows named in calendar.json, in card order", () => {
  const ids = new Set(read("calendar.json").items.map((i) => i.id));
  const want = cardRows().filter((e) => ids.has(e.id));
  assert.deepEqual(read("entries-cal.json"), want);
});

test("month, place and age filters list the same cards as the card file would", async () => {
  const { window, document } = await loadPage("calendar.html", { now: NOW });
  await new Promise((r) => setTimeout(r, 300));
  const L = window.TIG.lib;
  const cal = read("calendar.json").items, all = cardRows(), by = {};
  all.forEach((e) => (by[e.id] = e));
  const inWindow = (it, m) => (it.opens && it.closes ? (it.opens <= it.closes ? m >= it.opens && m <= it.closes : m >= it.opens || m <= it.closes) : m === (it.opens || it.closes));
  const count = () => document.querySelectorAll("#cClose .card, #cOpen .card").length;
  const sel = (id, v) => { const s = document.getElementById(id); s.value = v; s.dispatchEvent(new window.Event("change", { bubbles: true })); };
  // page month is October here, so compare the page's own month against the reference count
  for (const [place, age] of [["", ""], ["", "13"], ["state:CA", ""], ["state:CA", "16"]]) {
    sel("cAge", age);
    if (place && ![...document.getElementById("cPlace").options].some((o) => o.value === place)) continue;
    sel("cPlace", place);
    const m = +document.querySelector('#months .chip[aria-pressed="true"]').dataset.m;
    const ref = cal.filter((it) => by[it.id] && inWindow(it, m) && L.matches(by[it.id], { age: age || undefined, place: place || undefined }, NOW)).length;
    assert.equal(count(), ref, place + " " + age);
  }
  window.close();
});

test("place picker offers only places with a calendar program", async () => {
  const { window, document } = await loadPage("calendar.html", { now: NOW });
  await new Promise((r) => setTimeout(r, 300));
  const opts = [...document.getElementById("cPlace").options];
  assert.ok(opts.length > 1);
  assert.ok(opts.every((o) => !/\(none yet\)/.test(o.textContent)));
  window.close();
});
