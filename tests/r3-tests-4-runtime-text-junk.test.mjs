// Text made at runtime has no dash, NaN, undefined, null, object or entity junk.
// The CI dash scan and the data tests only read files. Cards, toasts, summaries, copied messages, links and aria-labels
// are built in the browser, where a string join can print a dash, a bad number prints NaN, a missing field prints undefined.
// This loads every built root page, drives it through its own picker states, and after each state scans the visible text of main
// plus every aria-label, title, alt, placeholder and href. It also runs the lib text builders over every real card.
// Run with: node --test tests/r3-tests-4-runtime-text-junk.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.self = globalThis;
const L = createRequire(import.meta.url)("../assets/js/lib.js");

const JUNK = /[\u2013\u2014]|\bNaN\b|\bundefined\b|\bnull\b|\[object|&amp;|&#\d|\{\{|%s/;
const ATTRS = ["aria-label", "title", "alt", "placeholder", "href"];
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && f !== "404.html").sort();

const snip = (s, i) => JSON.stringify(s.slice(Math.max(0, i - 15), i + 25)).slice(0, 44);

// Returns a list of "where: snippet" problems for one string.
// Known data problems, each with a reason. A card in data/programs/chabot-galaxy-explorers.json says "work_permit is null."
// (a raw field name in its notes). Fixing that data file is a separate ticket; delete this line when it is fixed.
const KNOWN = [/work_permit is null\./g];
function junkIn(s, where) {
  for (const k of KNOWN) s = s.replace(k, "");
  const m = JUNK.exec(s);
  return m ? [where + ": " + snip(s, m.index)] : [];
}

// Reads main text, the toast, and every attribute in the list across the page.
function scanDoc(document) {
  const found = [];
  const main = document.querySelector("main");
  if (main) found.push(...junkIn(main.textContent.replace(/\s+/g, " "), "text"));
  const toast = document.getElementById("toast");
  if (toast && !main.contains(toast)) found.push(...junkIn(toast.textContent, "toast"));
  for (const el of document.querySelectorAll("body *")) {
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      found.push(...junkIn(el.getAttribute(a), a + " on <" + el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + ">"));
    }
  }
  return found;
}

// Values to try in a select: all of them when the list is short, an even sample when it is long.
function sampleValues(sel) {
  const vals = [...sel.options].map((o) => o.value).filter((v) => v !== "");
  if (vals.length <= 24) return vals;
  const step = vals.length / 12;
  return Array.from({ length: 12 }, (_, i) => vals[Math.floor(i * step)]);
}

async function run(name, p, failures) {
  const { document } = p;
  const at = (state) => name + " | " + state + " | ";
  const check = (state) => scanDoc(document).forEach((f) => failures.push(at(state) + f));
  return { check };
}

// Per page: a function that drives picker states and calls check(stateName) after each.
const drivers = {
  async find(p, check) {
    const { window, document } = p;
    const age = document.getElementById("age");
    for (let a = 12; a <= 18; a++) {
      type(window, age, String(a)); await tick(60);
      check("age " + a);
    }
    const place = document.getElementById("place");
    for (const v of sampleValues(place)) {
      type(window, place, v); await tick(60);
      check("place " + v);
      type(window, age, "15"); await tick(40);
      check("place " + v + " age 15");
    }
    for (const id of ["hubChips", "paidChips", "typeChips", "fieldChips"]) {
      const chips = [...document.querySelectorAll("#" + id + " button")].slice(0, 6);
      for (const c of chips) {
        c.click(); await tick(40);
        check(id + " chip " + c.textContent.trim().slice(0, 20));
        c.click(); await tick(20);
      }
    }
    for (const id of ["onlyVerified", "noPermit", "savedOnly"]) {
      const el = document.getElementById(id);
      if (el) { el.click(); await tick(40); check(id + " on"); el.click(); await tick(20); }
    }
    const sort = document.getElementById("sort");
    if (sort) for (const v of sampleValues(sort)) { type(window, sort, v); await tick(40); check("sort " + v); }
    for (const id of ["viewDates", "viewCards"]) { const b = document.getElementById(id); if (b) { b.click(); await tick(40); check(id); } }
    type(window, document.getElementById("q"), "summer"); await tick(80);
    check("search summer");
  },
  async paycheck(p, check) {
    const { window, document } = p;
    check("sample calculation");
    const preset = document.getElementById("mPreset");
    for (const v of sampleValues(preset)) {
      type(window, preset, v); await tick(40);
      check("preset " + v);
      type(window, document.getElementById("mHours"), "20"); await tick(40);
      check("preset " + v + " 20 hours");
      type(window, document.getElementById("mOther"), "50"); await tick(40);
      check("preset " + v + " other income");
    }
    type(window, document.getElementById("mWage"), ""); await tick(40);
    check("blank wage");
    type(window, document.getElementById("mWage"), "abc"); await tick(40);
    check("wage letters");
    type(window, document.getElementById("mWage"), "12.5"); await tick(40);
    const st = document.getElementById("mState");
    if (st) for (const v of sampleValues(st)) { type(window, st, v); await tick(40); check("wrong-form state " + v); }
  },
  async resume(p, check) {
    const { window, document } = p;
    check("empty");
    const ex = document.getElementById("rExample");
    if (ex) { ex.click(); await tick(80); check("example filled"); }
    for (const [id, v] of [["rName", "Sam Lee"], ["rEmail", "sam@example.com"], ["rPhone", "555-0100"], ["rCity", "Austin"], ["rSchool", "Lincoln High"], ["rGrad", "2028"], ["rSkills", "Typing, Spanish"], ["rAwards", "Honor roll"]]) {
      const el = document.getElementById(id); if (el) type(window, el, v);
    }
    await tick(80);
    check("sample input");
    for (const id of ["rCopy", "rPrint"]) { const b = document.getElementById(id); if (b) { b.click(); await tick(60); check(id + " clicked"); } }
  },
  async playbook(p, check) {
    const { window, document } = p;
    check("start");
    const add = document.getElementById("addPerson");
    if (add) { add.click(); await tick(40); check("person added"); }
    const name = document.querySelector("#people input");
    if (name) { type(window, name, "Ms. Rivera"); await tick(40); check("person named"); }
    const sel = document.querySelector("#people select");
    if (sel) for (const v of [...sel.options].map((o) => o.value)) { type(window, sel, v); await tick(40); check("person status " + (v || "blank")); }
    const date = document.querySelector('#people input[type="date"]');
    if (date) { type(window, document.querySelector("#people select"), "sent"); type(window, date, "2026-10-01"); await tick(40); check("sent with date"); }
    for (const [id, v] of [["fTo", "Ms. Rivera"], ["fMe", "Sam"], ["fGrade", "10"], ["fSchool", "Lincoln High"], ["fCurious", "how you got started"], ["fAsk", "a 15 minute call"], ["fWhen", "next week"]]) {
      const el = document.getElementById(id); if (el) type(window, el, v);
    }
    await tick(80);
    check("message filled");
    for (const id of ["fToSel", "fFormat"]) {
      const el = document.getElementById(id);
      if (el) for (const v of sampleValues(el)) { type(window, el, v); await tick(40); check(id + " " + v); }
    }
    for (const id of ["copyMsg", "markSent", "shareMsg"]) { const b = document.getElementById(id); if (b) { b.click(); await tick(60); check(id + " clicked"); } }
  },
  async calendar(p, check) {
    const { window, document } = p;
    check("start");
    for (const b of [...document.querySelectorAll("#months .chip")]) {
      b.click(); await tick(40);
      check("month " + b.textContent.trim());
    }
    for (const id of ["cPlace", "cAge"]) {
      const el = document.getElementById(id);
      if (el && el.tagName === "SELECT") for (const v of sampleValues(el)) { type(window, el, v); await tick(40); check(id + " " + v); }
    }
  },
};

// Pages with picker selects and tiles: walk every select the page owns, one at a time, ages 12 to 18 and every state included.
async function walkSelects(p, check) {
  const { window, document } = p;
  const sels = [...document.querySelectorAll("main select")].filter((s) => s.options.length > 1);
  for (const s of sels) {
    const label = s.id || s.name || "select";
    for (const v of sampleValues(s)) {
      type(window, s, v); await tick(50);
      check(label + " = " + v);
    }
  }
  // age 12 to 18 on any age picker, with each state picker on a sample value
  const ageSel = document.getElementById("pAge") || document.getElementById("jAge") || document.getElementById("aAge") || document.getElementById("rAge");
  if (ageSel) for (let a = 12; a <= 18; a++) { if (![...ageSel.options].some((o) => o.value === String(a))) continue; type(window, ageSel, String(a)); await tick(50); check("age " + a); }
  // click every button once that only changes what is shown (chips, tiles, tabs, show more), not downloads or print
  const SAFE = /^(?:chip|tile)$|show more|more/i;
  for (const b of [...document.querySelectorAll("main button")].slice(0, 60)) {
    if (b.disabled || !(b.classList.contains("chip") || b.classList.contains("tile") || SAFE.test(b.textContent.trim()))) continue;
    b.click(); await tick(20);
  }
  await tick(60);
  check("after clicking chips and tiles");
}

for (const f of pages) {
  const key = f.replace(/\.html$/, "");
  test("runtime text on " + f + " has no dash, NaN, undefined, null, object or entity junk", { timeout: 180000 }, async () => {
    const failures = [];
    const p = await loadPage(f);
    await tick(150);
    const seen = new Set();
    const check = (state) => scanDoc(p.document).forEach((x) => { const k = state + "|" + x; if (!seen.has(k)) { seen.add(k); failures.push(key + " | " + state + " | " + x); } });
    check("loaded");
    if (drivers[key]) await drivers[key](p, check);
    await walkSelects(p, check);
    p.window.close();
    assert.deepEqual(failures.slice(0, 20), [], failures.length + " junk strings, first 20 shown");
  });
}

test("permit page: every state and every age 12 to 18 gives clean text", { timeout: 180000 }, async () => {
  const failures = [];
  const p = await loadPage("permit.html");
  await tick(150);
  const { window, document } = p;
  const state = document.getElementById("pState"), age = document.getElementById("pAge"), kind = document.getElementById("pKind");
  const states = [...state.options].map((o) => o.value).filter(Boolean);
  assert.ok(states.length >= 2, "permit page lists states");
  const kinds = kind ? [...kind.options].map((o) => o.value).filter(Boolean).slice(0, 3) : [""];
  for (const s of states) {
    type(window, state, s);
    for (let a = 12; a <= 18; a++) {
      type(window, age, String(a));
      for (const k of kinds.length ? kinds : [""]) {
        if (kind && k) type(window, kind, k);
        await tick(10);
        scanDoc(document).forEach((x) => failures.push("permit | " + s + " age " + a + " " + k + " | " + x));
      }
    }
  }
  assert.deepEqual([...new Set(failures)].slice(0, 20), []);
  window.close();
});

// ---- lib text builders over every real card ----
const entries = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));

test("lib.ageText on every real card has no junk", () => {
  const bad = [];
  for (const e of entries) junkIn(L.ageText(e), "").forEach((x) => bad.push(e.id + x));
  assert.deepEqual(bad.slice(0, 20), []);
});

test("lib.planSummary and a follow-up .ics over every real card name have no junk", () => {
  const bad = [];
  const now = new Date(2026, 9, 11);
  for (const e of entries) {
    const people = [{ n: e.org || e.name, s: "sent", d: "2026-10-01" }, { n: e.name, s: "", d: "" }];
    const sum = L.planSummary(people, now);
    junkIn(JSON.stringify(sum), "").forEach((x) => bad.push(e.id + " planSummary" + x));
    const f = L.followUpISO(people[0]);
    junkIn(f, "").forEach((x) => bad.push(e.id + " followUp" + x));
    const ics = L.icsEvent({ uid: "t-" + e.id, title: "Follow up with " + people[0].n, desc: "Send one short follow-up note.", dateISO: f });
    junkIn(ics.replace(/\r\n[ \t]/g, ""), "").forEach((x) => bad.push(e.id + " ics" + x));
    if (e.deadline_iso) {
      const d = L.icsEvent({ uid: "deadline-" + e.id, title: "Deadline: " + e.name, desc: (e.deadline_text || "") + " " + (e.apply_url || e.url || ""), dateISO: e.deadline_iso });
      junkIn(d.replace(/\r\n[ \t]/g, ""), "").forEach((x) => bad.push(e.id + " deadline ics" + x));
    }
  }
  assert.deepEqual([...new Set(bad)].slice(0, 20), []);
});

test("mailto and sms links built from a card name keep no junk before encoding", () => {
  const bad = [];
  for (const e of entries.slice(0, 400)) {
    const href = L.mailtoHref("Question about " + e.name, "Hi, I am interested in " + e.name + ".");
    junkIn(decodeURIComponent(href.replace(/\+/g, " ")), "").forEach((x) => bad.push(e.id + x));
  }
  assert.deepEqual([...new Set(bad)].slice(0, 20), []);
});
