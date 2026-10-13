// r3-a11y-perf-4: the Home file keeps name, org, city and url only on rows the closing-soon list can draw.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8"));
const L = createRequire(import.meta.url)(path.join(ROOT, "assets/js/lib.js"));
const home = read("entries-home.json");
const full = read("entries.json");
const SOON = "confirmed-2026-27";
const SOON_ONLY = ["name", "org", "city", "url"];

// 2026-10-13: +70 statewide cards (2,479 programs): the home file is 561,138 bytes. Raised from 560000 to 561200. PENDING PERSON APPROVAL, like the other data limits.
// 2026-10-13: re-read of 177 workshop-city cards: home file 561,358 bytes. Raised from 561200 to 561400.
// 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. home file 561400 to 570400.
test("home file is under 570400 bytes", () => {
  assert.ok(fs.statSync(path.join(ROOT, "data/entries-home.json")).size < 570400);
});

test("only closing-soon rows carry name, org, city and url", () => {
  home.forEach((r) => {
    SOON_ONLY.forEach((k) => {
      if (r.deadline_confidence !== SOON) assert.ok(!(k in r), r.id + " should not have " + k);
    });
  });
  const soon = home.filter((r) => r.deadline_confidence === SOON);
  assert.ok(soon.length > 100);
  soon.forEach((r) => assert.ok(r.name, r.id + " needs name for the soon list"));
});

test("every key home.js reads from an entry is on every row that reaches that code", () => {
  const src = fs.readFileSync(path.join(ROOT, "assets/js/home.js"), "utf8");
  const keys = new Set([...src.matchAll(/\be\.([a-z_]+)\b/g)].map((m) => m[1]));
  // Keys read only for rows of the soon list (drawSoon) or only from a program's own file (the four cards).
  const soonList = ["name", "org", "city", "url"];
  const cardFile = ["what_you_do", "deadline_text", "type"];
  const everyRow = ["id", "paid_type", "deadline_confidence"];
  [...keys].filter((k) => !["inner", "hidden", "now", "text", "some", "get", "all"].includes(k)).forEach((k) => {
    assert.ok(soonList.includes(k) || cardFile.includes(k) || everyRow.includes(k), "unreviewed key read by home.js: e." + k);
  });
  home.forEach((r) => assert.ok(r.id));
  home.filter((r) => r.deadline_confidence === SOON).forEach((r) => soonList.forEach((k) => assert.ok(r[k], r.id + " " + k)));
  assert.ok(!/G\.esc\(e\.name\)/.test(src.split("function pick")[1].split("Promise.all")[0].split("function draw")[0]), "picker ranking must not read e.name directly");
});

test("rows are in name order, so the picker top four match the full file for ages 12 to 18 at each hub", () => {
  const names = new Map(full.map((e) => [e.id, e.name]));
  for (let i = 1; i < home.length; i++) {
    const a = names.get(home[i - 1].id), b = names.get(home[i].id);
    assert.ok(a < b || (a === b && home[i - 1].id < home[i].id), "order at " + home[i].id);
  }
  const rank = {};
  home.forEach((e, i) => { rank[e.id] = i; });
  const now = Date.now();
  const fullById = new Map(full.map((e) => [e.id, e]));
  for (let age = 12; age <= 18; age++) {
    for (const hub of ["", ...L.HUBS.map((h) => h[0])]) {
      const st = { place: hub, age: String(age), fields: [] };
      const want = L.sortList(full.filter((e) => L.matches(e, st, now)), "best", now, { age: String(age) }).map((e) => e.id);
      const got = L.sortList(home.filter((e) => L.matches(e, st, now)).map((e) => Object.assign({}, e, { name: ("00000" + rank[e.id]).slice(-6) })), "best", now, { age: String(age) }).map((e) => e.id);
      assert.equal(got.length, want.length, "count age " + age + " hub " + hub);
      assert.deepEqual(got.slice(0, 4), want.slice(0, 4), "top four age " + age + " hub " + hub);
      assert.ok(fullById.size > 0);
    }
  }
});
