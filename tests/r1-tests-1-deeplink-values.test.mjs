// Every "<page>.html?key=value" link we ship uses a page, key and value that the target page accepts.
// Sources: built root *.html files and string literals in assets/js/*.js.
// A link whose value is built at run time (the literal ends in "=") is checked for page and key only.
// Run with: node --test tests/r1-tests-1-deeplink-values.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const json = (f) => JSON.parse(read("data/" + f));

// Links that are wrong today, with the reason. Empty on purpose: add "file | link" here only with a reason.
const ALLOW = {};

const permits = json("permits.json"), money = json("money.json"), langs = json("languages.json");
const transit = json("transit.json"), younger = json("younger.json");
const options = (file, id) => {
  const m = read(file).match(new RegExp('<select[^>]*id="' + id + '"[\\s\\S]*?</select>'));
  return m ? [...m[0].matchAll(/value="([^"]*)"/g)].map((x) => x[1]).filter(Boolean) : [];
};
const jobsNames = [...read("assets/js/jobs.js").match(/var NAMES = \{([^}]*)\}/)[1].matchAll(/\b([A-Z]{2}):/g)].map((x) => x[1]);
// lib lists are either objects keyed by id or arrays of [id, label, ...]
const ids = (x) => (Array.isArray(x) ? x.map((r) => r[0]) : Object.keys(x));
const age = (lo, hi) => (v) => /^\d+$/.test(v) && +v >= lo && +v <= hi;
const inList = (xs) => (v) => xs.includes(v);
const each = (ok) => (v) => v.split(",").filter(Boolean).length > 0 && v.split(",").filter(Boolean).every(ok);
const permitStates = Object.keys(permits.states);
const moneyIds = money.presets.map((p) => p.id).concat(money.states.map((s) => s.id));

// page -> key -> value check. A key here must also be read by the page's script (checked below).
const VALUES = {
  find: {
    q: () => true, age: age(12, 18), kind: each(inList(ids(L.TYPES))), where: each(inList(ids(L.HUBS))),
    at: (v) => !!L.placeRegions(v), interest: each(inList(ids(L.FIELDS))), pay: each(inList(ids(L.PAID_GROUPS))),
    when: inList(options("find.html", "when")), season: inList(options("find.html", "season")), sort: inList(options("find.html", "sort")),
    view: inList(["dates", "cards"]), checked: inList(["1"]), nopermit: inList(["1"]),
  },
  jobs: { age: inList(["12", "13", "u14", "14", "15", "16", "17", "18"]), state: inList(jobsNames) },
  permit: { state: inList(permitStates), age: age(12, 18), kind: inList(permits.kinds.map((k) => k[0])) },
  paycheck: { state: inList(moneyIds.concat(money.states.map((s) => s.id))) },
  interview: { state: inList(permitStates), age: age(12, 18) },
  languages: { lang: inList(langs.languages.map((l) => l[0])), state: inList(langs.rows.map((r) => r.state)) },
  ready: { ride: inList(transit.places.map((p) => p.id).concat(["bay", "other"])), state: (v) => /^[a-z]{2}$/.test(v) },
  younger: { age: inList(["12", "13", "14"]), state: inList(younger.states.map((s) => s[0])) },
  states: { state: inList(permitStates) },
  safety: { state: (v) => v.length > 0 },
  calendar: { m: age(1, 12), at: (v) => !!L.placeRegions(v), age: age(12, 18) },
};
// Keys read through a loop the plain pattern cannot see (permit.js: ["State", "Age", "Kind"].forEach(... n.toLowerCase())).
const EXTRA_READS = { permit: ["state", "age", "kind"] };

function readKeys(page) {
  const f = path.join(ROOT, "assets/js", page + ".js");
  const src = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
  const keys = new Set(EXTRA_READS[page] || []);
  for (const m of src.matchAll(/\b(?:get|has|list)\(\s*["'](\w+)["']/g)) keys.add(m[1]);
  return keys;
}

// Collect links: { source, link, page, pairs: [[key, value]] }
export function collect(sources) {
  const out = [];
  for (const [source, text] of sources) {
    for (const m of text.matchAll(/\b([a-z0-9-]+)\.html\?([A-Za-z0-9_=&;%,.+-]*)/g)) {
      const pairs = m[2].replace(/&amp;/g, "&").split("&").filter(Boolean).map((p) => { const i = p.indexOf("="); return i < 0 ? [p, ""] : [p.slice(0, i), decodeURIComponent(p.slice(i + 1))]; });
      if (pairs.length) out.push({ source, link: m[0], page: m[1], pairs });
    }
  }
  return out;
}

const rootHtml = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && f !== "404.html");
const jsFiles = fs.readdirSync(path.join(ROOT, "assets/js")).filter((f) => f.endsWith(".js"));
const links = collect(rootHtml.map((f) => [f, read(f)]).concat(jsFiles.map((f) => ["assets/js/" + f, read("assets/js/" + f)])));

// Check one link. Returns a list of problem strings (empty when fine).
export function problems(l) {
  const bad = [];
  if (!fs.existsSync(path.join(ROOT, l.page + ".html"))) return ["page " + l.page + ".html does not exist"];
  const rules = VALUES[l.page], reads = readKeys(l.page);
  if (!rules) return ["no value rules for page " + l.page];
  for (const [k, v] of l.pairs) {
    if (!rules[k]) { bad.push("key " + k + " has no value rule for " + l.page); continue; }
    if (!reads.has(k)) bad.push("key " + k + " is not read by assets/js/" + l.page + ".js");
    if (v !== "" && !rules[k](v)) bad.push("value " + k + "=" + v + " is not accepted");
  }
  return bad;
}

test("we found the deep links this test is meant to cover", () => {
  assert.ok(links.length >= 40, "only " + links.length + " links collected");
  for (const p of ["find", "jobs", "permit", "paycheck", "languages", "ready", "interview"]) assert.ok(links.some((l) => l.page === p), "no link to " + p + ".html found");
  assert.ok(links.some((l) => l.page === "find" && l.pairs.some(([k, v]) => k === "kind" && v)), "no find kind link");
  assert.ok(links.some((l) => l.page === "ready" && l.pairs.some(([k]) => k === "ride")), "no ready ride link");
});

test("the checker rejects a typo and a missing page", () => {
  const mk = (page, k, v) => ({ page, pairs: [[k, v]] });
  assert.ok(problems(mk("find", "kind", "reasearch")).length);
  assert.ok(problems(mk("find", "age", "19")).length);
  assert.ok(problems(mk("find", "kind", "research")).length === 0);
  assert.ok(problems(mk("permit", "state", "zz")).length);
  assert.ok(problems(mk("languages", "lang", "xx")).length);
  assert.ok(problems(mk("ready", "ride", "paris")).length);
  assert.ok(problems(mk("nowhere", "a", "b")).length);
  assert.ok(problems(mk("find", "colour", "red")).length);
});

const seen = new Set();
for (const l of links) {
  const id = l.source + " | " + l.link;
  if (seen.has(id)) continue;
  seen.add(id);
  test("deep link " + l.link + " in " + l.source, () => {
    const key = l.source + " | " + l.link;
    if (ALLOW[key]) return;
    const bad = problems(l);
    assert.deepEqual(bad, [], "Bad link " + l.link + " in " + l.source + ": " + bad.join("; "));
  });
}
