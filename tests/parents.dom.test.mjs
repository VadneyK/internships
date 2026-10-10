import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const json = (rel) => JSON.parse(read(rel));

const parents = json("data/parents.json");
const permits = json("data/permits.json");
const money = json("data/money.json");
const languages = json("data/languages.json");
const BUILT = new Set(fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")));

// ---------- helpers ----------

// Every statement in parents.json: an object with a text "t" and the page it comes from "p". State rows use "parent" and "p".
function statements() {
  const out = [];
  (function walk(v, where) {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
    else if (v && typeof v === "object") {
      if (typeof v.t === "string" && typeof v.p === "string") out.push({ text: v.t, p: v.p, where });
      else if (typeof v.parent === "string" && typeof v.p === "string") out.push({ text: v.parent, p: v.p, where, state: v.id });
      for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
    }
  })(parents, "$");
  return out;
}
const ALL = statements();

const idCache = new Map();
function idsOf(file) {
  if (!idCache.has(file)) {
    const doc = new JSDOM(read(file)).window.document;
    idCache.set(file, new Set([...doc.querySelectorAll("[id]")].map((el) => el.id)));
  }
  return idCache.get(file);
}

// Checks one internal reference such as "permit.html?state=ca" or "rules.html#safe". Returns a list of problems.
function refProblems(ref) {
  const problems = [];
  const [beforeHash, frag] = ref.split("#");
  const [file, query] = beforeHash.split("?");
  if (!BUILT.has(file)) return [`${ref}: no built page ${file}`];
  if (file === "leaders.html") problems.push(`${ref}: leaders.html is unlisted and must not be linked`);
  if (frag && !idsOf(file).has(frag)) problems.push(`${ref}: no id "${frag}" in ${file}`);
  if (query) {
    const sp = new URLSearchParams(query);
    if (file === "permit.html") {
      for (const [k, v] of sp) {
        if (k !== "state") problems.push(`${ref}: permit.html does not read "${k}"`);
        else if (!permits.states[v]) problems.push(`${ref}: "${v}" is not a state in permits.json`);
      }
    } else if (file === "languages.html") {
      for (const [k, v] of sp) {
        if (k !== "lang") problems.push(`${ref}: languages.html does not read "${k}"`);
        else if (!languages.languages.some((l) => l[0] === v)) problems.push(`${ref}: "${v}" is not a language in languages.json`);
      }
    } else problems.push(`${ref}: ${file} takes no query`);
  }
  return problems;
}

// The words a page is allowed to be quoted from: its built text plus the data files its script draws from.
const DATA_FOR = {
  "permit.html": ["data/permits.json"],
  "languages.html": ["data/languages.json"],
  "younger.html": ["data/younger.json"],
  "paycheck.html": ["data/money.json"],
  "interview.html": ["data/interview.json"],
};
const corpusCache = new Map();
function corpus(file) {
  if (!corpusCache.has(file)) {
    const html = new JSDOM(read(file)).window.document.body.textContent;
    const data = (DATA_FOR[file] || []).map((f) => JSON.stringify(json(f))).join(" ");
    corpusCache.set(file, html + " " + data);
  }
  return corpusCache.get(file);
}
// Numbers, money, phone numbers and form numbers in a sentence: "$16.90", "833-526-4636", "B1-1", "6.2".
function numbersIn(text) {
  return (text.match(/\d[\d,.\-]*\d|\d/g) || []).map((n) => n.replace(/[.,\-]+$/, ""));
}

// Flesch-Kincaid grade, same method as tests/r3-tests-4.test.mjs.
function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  let n = (w.match(/[aeiouy]+/g) || []).length;
  if (n > 1 && /e$/.test(w) && !/[^aeiouy]le$/.test(w)) n -= 1;
  return Math.max(1, n);
}
function grade(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.split(/[.!?]+(?:\s+|$)/).filter((s) => /[A-Za-z]/.test(s));
  const words = clean.match(/[A-Za-z']+/g) || [];
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  return 0.39 * (words.length / sentences.length) + 11.8 * (syl / words.length) - 15.59;
}

// ---------- the page ----------

test("parents: loads clean, draws every part, and shows no undefined or NaN", async () => {
  const p = await loadPage("parents.html"); await tick(200);
  const { document } = p;
  assert.deepEqual(p.errors, []);
  assert.equal(document.querySelectorAll("h1").length, 1);
  assert.equal(document.querySelectorAll("#signT tbody tr").length, Object.keys(permits.states).length, "one row per place in the permit finder");
  for (const id of ["signLead", "signNote", "signOthers", "langLead", "langChips", "helpLead", "helpPlaybook", "helpInterview", "moneyLead", "moneyPay", "moneyTaxes", "moneyWrong", "moneyBank", "youngLead", "youngItems", "safeLead", "safeContact", "safeFlags", "safeOnline", "safeScams", "safeWork", "gapsL"]) {
    assert.ok(document.getElementById(id).textContent.trim().length > 20, `#${id} is empty`);
  }
  assert.doesNotMatch(document.body.textContent, /undefined|NaN|\{\{/);
  const nav = [...document.querySelectorAll("#main nav.chips a")];
  assert.deepEqual(nav.map((a) => a.getAttribute("href")), ["#sign", "#help", "#money", "#young", "#safe", "#gaps"]);
  for (const a of nav) assert.ok(document.getElementById(a.getAttribute("href").slice(1)), `${a.getAttribute("href")} has no target`);
});

test("parents: every statement shows the page it comes from, as a link to that page", async () => {
  const { document } = await loadPage("parents.html"); await tick(200);
  const shown = [...document.querySelectorAll("#main .src a")].map((a) => a.getAttribute("href")).sort();
  assert.deepEqual(shown, ALL.map((s) => s.p).sort(), "the From links are exactly the statements in data/parents.json");
  for (const span of document.querySelectorAll("#main .src")) {
    const a = span.querySelector("a");
    const name = parents.pages[a.getAttribute("href").split("#")[0].split("?")[0]];
    assert.ok(name, `no page name for ${a.getAttribute("href")}`);
    assert.equal(a.textContent, name);
    assert.match(span.textContent, /^From /);
  }
});

test("parents: every internal link on the whole page (header, body, footer) resolves to a built page and a real id, and leaders.html is never linked", async () => {
  const { document } = await loadPage("parents.html"); await tick(200);
  const problems = [];
  let internal = 0;
  for (const a of document.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (/^(https?:|mailto:|tel:)/.test(href)) continue;
    internal++;
    if (href.startsWith("#")) { if (!document.getElementById(href.slice(1))) problems.push(`${href}: no such id on this page`); continue; }
    problems.push(...refProblems(href));
  }
  assert.ok(internal >= 40, `expected many internal links, found ${internal}`);
  assert.deepEqual(problems, []);
  assert.doesNotMatch(read("parents.html") + read("src/parents.html") + read("assets/js/parents.js") + read("data/parents.json"), /leaders/i);
});

test("parents: no external script, no outside link, nothing sent anywhere", () => {
  for (const rel of ["parents.html", "src/parents.html"]) {
    const doc = new JSDOM(read(rel)).window.document;
    for (const s of doc.querySelectorAll("script[src]")) assert.doesNotMatch(s.getAttribute("src"), /^(https?:)?\/\//, `${rel}: external script ${s.getAttribute("src")}`);
    assert.equal(doc.querySelectorAll("form").length, 0, "no form to submit");
  }
  const built = new JSDOM(read("parents.html")).window.document;
  assert.deepEqual([...built.querySelectorAll("script[src]")].map((s) => s.getAttribute("src").split("?")[0]), ["assets/js/lib.js", "assets/js/common.js", "assets/js/parents.js"]);
  const js = read("assets/js/parents.js");
  assert.doesNotMatch(js, /https?:\/\//, "parents.js has no outside address");
  assert.doesNotMatch(js, /XMLHttpRequest|sendBeacon|WebSocket|document\.cookie|localStorage|sessionStorage/);
  const fetches = [...js.matchAll(/fetch\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(fetches, ['"data/parents.json"']);
  // The links the page draws: outside links are not part of this page at all.
  assert.doesNotMatch(JSON.stringify(parents), /https?:\/\//);
});

test("parents: sits under Get ready in the nav, with a two step breadcrumb", async () => {
  const { document } = await loadPage("parents.html"); await tick(100);
  const current = document.querySelectorAll('nav.nav a[aria-current="page"]');
  assert.equal(current.length, 1);
  assert.match(current[0].textContent, /Get ready/);
  const crumbs = document.querySelectorAll('nav[aria-label="Breadcrumb"] li');
  assert.equal(crumbs.length, 2);
  assert.equal(crumbs[0].querySelector("a").getAttribute("href"), "ready.html");
  assert.equal(crumbs[1].getAttribute("aria-current"), "page");
});

test("parents: the build wires the page in: front matter, PAGES, footer, Get ready link, sitemap", () => {
  assert.match(read("src/parents.html"), /^title: .+\ndesc: .+\nscripts: parents\nnavparent: ready\n---\n/);
  assert.match(read("tools/build.py"), /PAGES = \[[^\]]*"parents"/);
  assert.match(read("src/_layout.html"), /<li><a href="parents\.html">For parents<\/a><\/li>/);
  assert.match(read("src/ready.html"), /href="parents\.html"/);
  assert.match(read("parents.html"), /<li><a href="parents\.html">For parents<\/a><\/li>/);
  assert.match(read("ready.html"), /href="parents\.html"/);
  assert.match(read("sitemap.xml"), /<loc>https:\/\/vadneyk\.github\.io\/internships\/parents\.html<\/loc>/);
});

test("parents: the place picker shows one row and All places brings them all back", async () => {
  const p = await loadPage("parents.html"); await tick(200);
  const { window, document } = p;
  const sel = document.getElementById("pState");
  assert.equal(sel.options.length, Object.keys(permits.states).length + 1);
  type(window, sel, "ny"); await tick(30);
  const rows = document.querySelectorAll("#signT tbody tr");
  assert.equal(rows.length, 1);
  assert.match(rows[0].textContent, /New York/);
  assert.match(rows[0].textContent, /A parent signs the application/);
  assert.match(rows[0].textContent, /888-469-7365/);
  assert.equal(rows[0].querySelector(".src a").getAttribute("href"), "permit.html?state=ny");
  type(window, sel, ""); await tick(30);
  assert.equal(document.querySelectorAll("#signT tbody tr").length, Object.keys(permits.states).length);
});

test("parents: language links open the language page with a language it lists", async () => {
  const { document } = await loadPage("parents.html"); await tick(200);
  const links = [...document.querySelectorAll("#langChips a")];
  assert.equal(links.length, parents.languages.list.length);
  assert.ok(links.length >= 6);
  assert.deepEqual(links.map((a) => a.getAttribute("href")), ["es", "zh", "ko", "vi", "tl", "uk"].map((c) => "languages.html?lang=" + c));
});

// ---------- the data ----------

test("parents.json: every statement names a page of this guide, with a real id, and has plain text", () => {
  assert.ok(ALL.length >= 90, `expected many statements, found ${ALL.length}`);
  const problems = [];
  for (const s of ALL) {
    const file = s.p.split("#")[0].split("?")[0];
    if (!parents.pages[file]) problems.push(`${s.where}: ${file} is not in parents.pages`);
    problems.push(...refProblems(s.p).map((x) => `${s.where}: ${x}`));
    if (!s.text.trim()) problems.push(`${s.where}: empty text`);
  }
  assert.deepEqual(problems, []);
  for (const [file, name] of Object.entries(parents.pages)) {
    assert.ok(BUILT.has(file), `${file} is not a built page`);
    assert.notEqual(file, "leaders.html");
    assert.ok(name.length > 3);
  }
});

test("parents.json: no dash characters, no curly quotes, no plain http address", () => {
  const text = read("data/parents.json");
  assert.doesNotMatch(text, new RegExp("[" + [0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d].map((c) => String.fromCharCode(c)).join("") + "]"));
  assert.doesNotMatch(text, /http:\/\//);
});

test("parents.json: every number, price, age and phone number in a statement is on the page it names", () => {
  const problems = [];
  for (const s of ALL) {
    const file = s.p.split("#")[0].split("?")[0];
    const have = corpus(file);
    for (const n of numbersIn(s.text)) {
      if (!have.includes(n)) problems.push(`${s.where} (${s.p}): "${n}" is not on ${file}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("parents.json: each state row matches data/permits.json (permit name, age, phone number) and keeps its own words", () => {
  const rows = parents.sign.states;
  assert.deepEqual(rows.map((r) => r.id), Object.keys(permits.states), "same places, same order as the permit finder");
  for (const r of rows) {
    const s = permits.states[r.id];
    assert.equal(r.name, s.name);
    assert.equal(r.permit, s.permit, `${r.id}: permit name`);
    assert.equal(r.call, s.call, `${r.id}: who to call`);
    assert.equal(r.need, s.needBelow ? `Under ${s.needBelow}` : "No general permit", `${r.id}: age rule`);
    assert.equal(r.p, `permit.html?state=${r.id}`);
    // A parent line must not claim a signature that permits.json does not mention.
    const mentionsParent = /\bparent|guardian/i.test([...s.steps, ...s.bring, s.issuer].join(" "));
    if (!mentionsParent) assert.doesNotMatch(r.parent, /parent or guardian signs|A parent signs|A parent applies/, `${r.id}: permits.json never mentions a parent`);
  }
  // The states where the finder says a parent signs, applies or fills in a form.
  const sign = { ca: /signs the Statement of Intent/, ny: /A parent signs the application/, il: /A parent applies in person/, wa: /parent or guardian,? .*sign/, wi: /parent or guardian applies/, nc: /parent or guardian, the teen and the employer sign/, pa: /parent or guardian fills out a written statement/, bc: /parent or guardian gives written permission/ };
  for (const [id, re] of Object.entries(sign)) assert.match(rows.find((r) => r.id === id).parent, re, id);
  // Where it does not say so, the row says so too.
  assert.match(rows.find((r) => r.id === "ga").parent, /do not say that a parent signs/);
  for (const id of ["tx", "mn", "in"]) assert.match(rows.find((r) => r.id === id).parent, /does not require|no longer requires/, id);
});

test("parents.json: the savings lines are the CFPB lines in data/money.json, word for word", () => {
  const bank = parents.money.bank.filter((s) => s.p === "paycheck.html#bank").map((s) => s.t);
  assert.deepEqual(bank, money.bank.items);
});

test("parents.json: the phone numbers match the finder and the pay data", () => {
  const all = ALL.map((s) => s.text).join(" ");
  for (const id of ["ca", "ga", "ny", "il"]) {
    const younger = json("data/younger.json").calls[id];
    const ph = younger.match(/\d{3}-\d{3}-\d{4}/)[0];
    assert.ok(all.includes(ph), `${id}: ${ph} (younger.json) is on the parents page`);
  }
  for (const st of money.states) {
    const ph = (st.call.match(/\d{1,3}-\d{3}-\d{3}-\d{4}|\d{3}-\d{3}-\d{4}/) || [])[0];
    assert.ok(ph && all.includes(ph), `${st.id}: ${ph} (money.json) is on the parents page`);
  }
});

test("parents.json: languages are the ones in data/languages.json", () => {
  for (const l of parents.languages.list) {
    const row = languages.languages.find((x) => x[0] === l.code);
    assert.ok(row, `${l.code} is not in languages.json`);
    assert.ok(row[1].includes(l.name), `${l.name} is not in "${row[1]}"`);
  }
  assert.equal(parents.languages.list.length, languages.languages.length, "all six languages are offered");
});

test("parents.json: plain words, about 8th grade on average and no very hard statement", () => {
  const grades = ALL.map((s) => ({ s, g: grade(s.text) }));
  const mean = grades.reduce((a, x) => a + x.g, 0) / grades.length;
  assert.ok(mean <= 8, `mean grade ${mean.toFixed(2)}`);
  const hard = grades.filter((x) => x.g > 12).map((x) => `${x.s.where} ${x.g.toFixed(1)}`);
  assert.deepEqual(hard, []);
});
