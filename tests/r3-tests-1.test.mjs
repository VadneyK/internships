// Sweeps every internal link the site can produce, not only the ones in the page as first loaded.
//
// (a) Static: every ...html[#frag][?query] written inside assets/js/*.js string literals, and inside every string
//     value of data/*.json, must point to a built page, an existing id, and only known query parameters.
// (b) Dynamic: pages are loaded in jsdom with their real scripts, every control that rewrites links is driven
//     (permit: every state x age 12 to 18 x kind; find: every place, Show more until all cards are shown, and the
//     dates view; calendar: every month; ready, states, interview, languages, paycheck, younger: every option),
//     and every anchor on the page is checked after each step.
//
// A link problem is: a file that is not served, a #fragment with no matching id, a query parameter the target page
// does not read, a bad parameter value, javascript: links, or target=_blank without rel noopener on an outside link.
// find.html#p-<id> anchors are written by find.js, so they are checked against the ids in data/entries.json.
//
// Run with: node --test tests/r3-tests-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

const permits = readJson("data/permits.json");
const entries = readJson("data/entries.json");
const ENTRY_IDS = new Set(entries.map((e) => e.id));
const STATE_KEYS = new Set(Object.keys(permits.states));
const KIND_KEYS = new Set(permits.kinds.map((k) => k[0]));
const BUILT_PAGES = new Set(fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")));

// Query parameters each page reads (found with grep on location.search, URLSearchParams and .get in assets/js).
// Any other parameter on a link to that page does nothing, so it is reported.
const PARAMS_BY_PAGE = {
  "find.html": ["q", "where", "at", "age", "when", "season", "pay", "kind", "interest", "checked", "nopermit", "view", "sort", "saved", "hub", "field"],
  "permit.html": ["state", "age", "kind"],
  "paycheck.html": ["state"],
  "interview.html": ["state", "age"],
  "younger.html": ["state"],
  "states.html": ["state"],
  "calendar.html": ["m", "at", "age"],
  "languages.html": ["lang", "state"],
  "ready.html": ["ride"],
};
const KNOWN_PARAMS = new Set(Object.values(PARAMS_BY_PAGE).flat());

// ---------- helpers ----------

const parsedCache = new Map();
function builtIds(file) {
  if (!parsedCache.has(file)) {
    const doc = new JSDOM(fs.readFileSync(path.join(ROOT, file), "utf8")).window.document;
    parsedCache.set(file, new Set([...doc.querySelectorAll("[id]")].map((el) => el.id)));
  }
  return parsedCache.get(file);
}

const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

// One internal reference: pageFile is the page the link opens, frag the part after #, query the part after ?.
// liveIds is the set of ids in the document the link sits in (only used for same-page "#frag" links).
// partial is true for a string literal that is only the front of a link (for example "find.html#p-").
function refProblems(where, href, { liveIds = null, selfFile = null, partial = false } = {}) {
  const problems = [];
  const hashAt = href.indexOf("#");
  const beforeHash = hashAt === -1 ? href : href.slice(0, hashAt);
  const frag = hashAt === -1 ? "" : safeDecode(href.slice(hashAt + 1));
  const qAt = beforeHash.indexOf("?");
  const filePart = safeDecode(qAt === -1 ? beforeHash : beforeHash.slice(0, qAt));
  const query = qAt === -1 ? "" : beforeHash.slice(qAt + 1);
  // A query can also sit after the fragment in malformed links such as page.html#id?x=1: report it.
  if (frag.includes("?")) problems.push(`${where} (query string after the #fragment)`);

  let target = selfFile;
  if (filePart) {
    const clean = filePart.replace(/^\.?\/+/, "");
    if (!BUILT_PAGES.has(clean) && !fs.existsSync(path.join(ROOT, clean))) {
      problems.push(`${where} (no such file "${clean}")`);
      return problems;
    }
    target = clean;
  }

  if (query) {
    const sp = new URLSearchParams(query.replace(/&amp;/g, "&"));
    const allowed = new Set(PARAMS_BY_PAGE[target] || []);
    for (const [k, v] of sp) {
      if (!KNOWN_PARAMS.has(k)) problems.push(`${where} (unknown query parameter "${k}")`);
      else if (!allowed.has(k)) problems.push(`${where} (${target} does not read "${k}")`);
      if (v === "" ) continue;
      if (k === "state" && !STATE_KEYS.has(v) && !(target === "languages.html")) problems.push(`${where} (state "${v}" is not in permits.json)`);
      if (k === "age" && !(/^\d+$/.test(v) && +v >= 12 && +v <= 18)) problems.push(`${where} (age "${v}" is not 12 to 18)`);
      if (k === "view" && !["cards", "dates"].includes(v)) problems.push(`${where} (view "${v}" is not cards or dates)`);
      if (k === "kind" && target === "permit.html" && !KIND_KEYS.has(v)) problems.push(`${where} (kind "${v}" is not in permits.json)`);
    }
  }

  if (frag) {
    if (target === "find.html" && frag.startsWith("p-")) {
      // find.js writes these ids at run time. A partial literal only has to start with the prefix.
      if (!partial || frag.length > 2) {
        if (!ENTRY_IDS.has(frag.slice(2))) problems.push(`${where} (no program with id "${frag.slice(2)}" in data/entries.json)`);
      }
    } else if (target && target.endsWith(".html")) {
      const ids = !filePart && liveIds ? liveIds : builtIds(target);
      if (!ids.has(frag)) problems.push(`${where} (no id "${frag}" in ${target})`);
    }
  }
  return problems;
}

// Every <a href> in a live or static document. rel is the page the links live in.
function linkProblems(doc, rel) {
  const problems = [];
  const liveIds = new Set([...doc.querySelectorAll("[id]")].map((el) => el.id));
  for (const a of doc.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href").trim();
    const where = `${rel} -> "${href}"`;
    if (/^(mailto|tel|sms):/i.test(href)) continue;
    if (/^javascript:/i.test(href)) { problems.push(`${where} (javascript: link)`); continue; }
    if (/^https?:\/\//i.test(href)) {
      if (a.getAttribute("target") === "_blank" && !/\bnoopener\b/.test(a.getAttribute("rel") || "")) {
        problems.push(`${where} (target=_blank without rel noopener)`);
      }
      continue;
    }
    problems.push(...refProblems(where, href, { liveIds, selfFile: rel }));
  }
  return problems;
}

// Finds page references inside free text: page.html, page.html#frag, page.html?a=b#frag.
// A reference must not be glued to a path or host (so "a.org/60.html", "internships/interview.html" and "pay%20rates.html" are skipped).
const REF = /(?<![\w./:@%-])([A-Za-z0-9_-]+\.html)((?:\?[\w=&;%.-]*)?)((?:#[\w%-]*)?)/g;
function refsInText(text) {
  const out = [];
  for (const m of text.matchAll(REF)) out.push({ href: m[1] + m[2] + m[3], endsAtEdge: m.index + m[0].length === text.length });
  return out;
}

// String literals ("..", '..', `..`) in JavaScript source, with escapes kept as they are.
function jsStringLiterals(src) {
  const out = [];
  const re = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
  for (const m of src.matchAll(re)) out.push(m[1] ?? m[2] ?? m[3] ?? "");
  return out;
}

function walkStrings(value, where, visit) {
  if (typeof value === "string") visit(value, where);
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, `${where}[${i}]`, visit));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walkStrings(v, `${where}.${k}`, visit);
}

// Adds every anchor currently on the page to the set of problems, tagged with the step that produced it.
function collect(doc, rel, step, sink, seen) {
  for (const p of linkProblems(doc, rel)) {
    const key = p;
    if (!seen.has(key)) { seen.add(key); sink.push(`${p} [${step}]`); }
  }
  return doc.querySelectorAll("a[href]").length;
}

const pageFailures = (p) => p.errors;

// ---------- self-check: the helper is not vacuous ----------

test("self-check: linkProblems reports a bad page, a bad id, a bad parameter, a bad program id and a bad target=_blank", () => {
  const doc = new JSDOM(`<body><section id="here"></section>
    <a href="nope.html">a</a>
    <a href="rules.html#no-such-id">b</a>
    <a href="permit.html?state=zz&age=15">c</a>
    <a href="permit.html?state=ca&age=40">d</a>
    <a href="permit.html?colour=red">e</a>
    <a href="find.html#p-no-such-program">f</a>
    <a href="#nowhere">g</a>
    <a href="javascript:void(0)">h</a>
    <a href="https://example.org/" target="_blank">i</a>
    <a href="ready.html?state=ca">j</a>
    <a href="find.html?view=table">k</a>
    </body>`).window.document;
  const problems = linkProblems(doc, "fake.html");
  assert.equal(problems.length, 11, problems.join("\n"));
  // And good links pass.
  const good = new JSDOM(`<body><section id="here"></section>
    <a href="rules.html#permit">a</a>
    <a href="states.html#georgia">b</a>
    <a href="ready.html#permit">c</a>
    <a href="permit.html?state=ca&age=15&kind=job">d</a>
    <a href="find.html?view=dates">e</a>
    <a href="find.html#p-${[...ENTRY_IDS][0]}">f</a>
    <a href="#here">g</a>
    <a href="https://example.org/" target="_blank" rel="noopener">h</a>
    <a href="mailto:a@b.org">i</a>
    </body>`).window.document;
  assert.deepEqual(linkProblems(good, "fake.html"), []);
});

test("self-check: the text scanners find references and skip hosts and paths", () => {
  assert.deepEqual(refsInText('<a href="rules.html#permit">x</a> and permit.html?state=ca&age=15').map((r) => r.href), ["rules.html#permit", "permit.html?state=ca&age=15"]);
  assert.deepEqual(refsInText("see https://www.example.org/60.html and vadneyk.github.io/internships/interview.html"), []);
  assert.deepEqual(jsStringLiterals(`var a = "x.html"; var b = 'y.html#z'; var c = "q \\"p.html\\"";`).length, 3);
});

// ---------- (a) static: JS string literals and data values ----------

test("static: every page link written inside assets/js/*.js resolves", () => {
  const problems = [];
  let seenRefs = 0;
  for (const f of fs.readdirSync(path.join(ROOT, "assets/js")).filter((n) => n.endsWith(".js")).sort()) {
    const src = fs.readFileSync(path.join(ROOT, "assets/js", f), "utf8");
    for (const lit of jsStringLiterals(src)) {
      if (!lit.includes(".html")) continue;
      for (const r of refsInText(lit)) {
        seenRefs++;
        problems.push(...refProblems(`assets/js/${f} -> "${r.href}"`, r.href, { partial: r.endsAtEdge }));
      }
    }
  }
  assert.ok(seenRefs >= 20, `expected to find at least 20 page links in the scripts, found ${seenRefs}`);
  assert.deepEqual([...new Set(problems)], []);
});

test("static: every page link written inside data/*.json string values resolves", () => {
  const problems = [];
  let seenRefs = 0;
  for (const f of fs.readdirSync(path.join(ROOT, "data")).filter((n) => n.endsWith(".json")).sort()) {
    walkStrings(readJson("data/" + f), "$", (s, where) => {
      if (!s.includes(".html")) return;
      for (const r of refsInText(s)) {
        seenRefs++;
        problems.push(...refProblems(`data/${f} ${where} -> "${r.href}"`, r.href));
      }
    });
  }
  assert.ok(seenRefs >= 4, `expected to find at least 4 page links in the data, found ${seenRefs}`);
  assert.deepEqual(problems, []);
});

// ---------- (b) dynamic: drive the pages and check every anchor ----------

// Sets a select to each of its option values in turn and checks the anchors after each.
async function eachOption(page, rel, id, sink, seen, { settle = 25 } = {}) {
  const { window, document } = page;
  const sel = document.getElementById(id);
  assert.ok(sel, `${rel} has no #${id}`);
  const values = [...sel.options].map((o) => o.value);
  for (const v of values) {
    type(window, sel, v);
    await tick(settle);
    collect(document, rel, `#${id}=${v}`, sink, seen);
  }
  return values.length;
}

test("dynamic: permit.html, every state x age 12 to 18 x kind", async () => {
  const page = await loadPage("permit.html");
  await tick(60);
  const { window, document } = page;
  const sink = [], seen = new Set();
  let anchors = 0, combos = 0;
  const stateSel = document.getElementById("pState");
  const stateValues = [...stateSel.options].map((o) => o.value).filter(Boolean);
  assert.ok(stateValues.length >= 18, "permit.html lists fewer states than permits.json");
  for (const st of Object.keys(permits.states)) assert.ok(stateValues.includes(st), `state ${st} missing from the picker`);
  for (const st of stateValues) {
    for (let age = 12; age <= 18; age++) {
      for (const [kind] of permits.kinds) {
        type(window, stateSel, st);
        type(window, document.getElementById("pAge"), String(age));
        type(window, document.getElementById("pKind"), kind);
        combos++;
        anchors += collect(document, "permit.html", `${st}/${age}/${kind}`, sink, seen);
      }
    }
  }
  assert.equal(combos, stateValues.length * 7 * permits.kinds.length);
  assert.ok(anchors > combos, "permit answers produced almost no links to check");
  assert.deepEqual(pageFailures(page), []);
  assert.deepEqual(sink, []);
});

test("dynamic: find.html, Show more until all cards are shown, every place and age, then the dates view", async () => {
  const page = await loadPage("find.html");
  await tick(120);
  const { window, document } = page;
  const sink = [], seen = new Set();
  const clickAllMore = async (step) => {
    for (let i = 0; i < 100; i++) {
      const more = document.getElementById("more");
      if (!more) return i;
      more.click();
      await tick(10);
    }
    assert.fail(`${step}: Show more never ran out`);
  };
  // All cards first.
  const clicks = await clickAllMore("all programs");
  assert.ok(clicks > 0, "expected Show more on the full list");
  const cards = document.querySelectorAll("#out article.prog").length;
  assert.ok(cards >= 100, `expected the full list, saw ${cards} cards`);
  const anchors = collect(document, "find.html", "all cards", sink, seen);
  assert.ok(anchors > cards, "cards produced almost no links");
  // The permit note changes with the place filter, so cycle every place.
  const place = document.getElementById("place");
  for (const v of [...place.options].map((o) => o.value)) {
    type(window, place, v);
    await tick(15);
    collect(document, "find.html", `place=${v}`, sink, seen);
  }
  type(window, place, "");
  await tick(15);
  // Dates view and the other age filters.
  document.getElementById("viewDates").click();
  await tick(30);
  collect(document, "find.html", "dates view", sink, seen);
  document.getElementById("viewCards").click();
  await tick(30);
  const age = document.getElementById("age");
  for (const v of [...age.options].map((o) => o.value)) {
    type(window, age, v);
    await tick(15);
    collect(document, "find.html", `age=${v}`, sink, seen);
  }
  assert.deepEqual(pageFailures(page), []);
  assert.deepEqual(sink, []);
});

test("dynamic: find.html opened with each view and with a program anchor", async () => {
  const sink = [], seen = new Set();
  for (const search of ["?view=dates", "?view=cards", "?age=13", "?age=16&at=ca"]) {
    const page = await loadPage("find.html", { search });
    await tick(100);
    for (let i = 0; i < 100 && page.document.getElementById("more"); i++) { page.document.getElementById("more").click(); await tick(8); }
    collect(page.document, "find.html", search, sink, seen);
    assert.deepEqual(pageFailures(page), [], search);
  }
  assert.deepEqual(sink, []);
});

test("dynamic: calendar.html, every month", async () => {
  const page = await loadPage("calendar.html");
  await tick(100);
  const { document } = page;
  const sink = [], seen = new Set();
  const months = [...document.querySelectorAll("#months .chip")];
  assert.equal(months.length, 12);
  let anchors = 0;
  for (const b of months) {
    b.click();
    await tick(15);
    anchors += collect(document, "calendar.html", "month " + b.getAttribute("data-m"), sink, seen);
  }
  assert.ok(document.querySelectorAll("a[href*='find.html#p-']").length > 0 || anchors > 0, "calendar produced no links");
  await eachOption(page, "calendar.html", "cPlace", sink, seen);
  await eachOption(page, "calendar.html", "cAge", sink, seen);
  assert.deepEqual(pageFailures(page), []);
  assert.deepEqual(sink, []);
});

test("dynamic: calendar.html month links point at real program cards", async () => {
  const page = await loadPage("calendar.html");
  await tick(100);
  const sink = [], seen = new Set();
  let details = 0;
  for (const b of page.document.querySelectorAll("#months .chip")) {
    b.click();
    await tick(15);
    details += page.document.querySelectorAll("a[href*='find.html#p-']").length;
    collect(page.document, "calendar.html", "month " + b.getAttribute("data-m"), sink, seen);
  }
  assert.ok(details > 0, "no Details links to check on the calendar");
  assert.deepEqual(sink, []);
});

test("dynamic: ready.html, every district and ride option", async () => {
  const page = await loadPage("ready.html");
  await tick(80);
  const sink = [], seen = new Set();
  collect(page.document, "ready.html", "first load", sink, seen);
  const a = await eachOption(page, "ready.html", "dist", sink, seen);
  const b = await eachOption(page, "ready.html", "rideSel", sink, seen);
  assert.ok(a > 1 && b > 1, "expected options in both lists");
  assert.deepEqual(pageFailures(page), []);
  assert.deepEqual(sink, []);
});

test("dynamic: states.html, every state opened", async () => {
  const page = await loadPage("states.html");
  await tick(80);
  const sink = [], seen = new Set();
  collect(page.document, "states.html", "first load", sink, seen);
  const n = await eachOption(page, "states.html", "moreSel", sink, seen);
  assert.ok(n > 5, "expected the state list to be filled");
  assert.ok(page.document.querySelectorAll("#moreOut a[href^='permit.html']").length >= 1, "no permit finder link in the open state card");
  assert.deepEqual(pageFailures(page), []);
  assert.deepEqual(sink, []);
});

test("dynamic: interview.html, every age, state and school option", async () => {
  const page = await loadPage("interview.html");
  await tick(80);
  const { window, document } = page;
  const sink = [], seen = new Set();
  collect(document, "interview.html", "first load", sink, seen);
  const ages = [...document.getElementById("aAge").options].map((o) => o.value);
  const states = [...document.getElementById("aState").options].map((o) => o.value);
  for (const age of ages) {
    for (const st of states) {
      type(window, document.getElementById("aAge"), age);
      type(window, document.getElementById("aState"), st);
      collect(document, "interview.html", `age=${age} state=${st}`, sink, seen);
    }
  }
  await eachOption(page, "interview.html", "aSchool", sink, seen);
  assert.deepEqual(pageFailures(page), []);
  assert.deepEqual(sink, []);
});

test("dynamic: languages.html, every language and state option", async () => {
  const page = await loadPage("languages.html");
  await tick(80);
  const { window, document } = page;
  const sink = [], seen = new Set();
  collect(document, "languages.html", "first load", sink, seen);
  const langs = [...document.getElementById("lLang").options].map((o) => o.value);
  const states = [...document.getElementById("lState").options].map((o) => o.value);
  for (const l of langs) {
    for (const s of states) {
      type(window, document.getElementById("lLang"), l);
      type(window, document.getElementById("lState"), s);
      collect(document, "languages.html", `lang=${l} state=${s}`, sink, seen);
    }
  }
  assert.ok(langs.length > 1 && states.length > 1, "expected options in both lists");
  assert.deepEqual(pageFailures(page), []);
  assert.deepEqual(sink, []);
});

test("dynamic: paycheck.html, every preset and state option, with and without a parent box", async () => {
  const page = await loadPage("paycheck.html");
  await tick(80);
  const { window, document } = page;
  const sink = [], seen = new Set();
  collect(document, "paycheck.html", "first load", sink, seen);
  const states = [...document.getElementById("mState").options].map((o) => o.value);
  for (const s of states) {
    for (const parent of [false, true]) {
      const box = document.getElementById("mParent");
      box.checked = parent;
      box.dispatchEvent(new window.Event("change", { bubbles: true }));
      type(window, document.getElementById("mState"), s);
      collect(document, "paycheck.html", `state=${s} parent=${parent}`, sink, seen);
    }
  }
  await eachOption(page, "paycheck.html", "mPreset", sink, seen);
  assert.ok(states.length > 1, "expected a state list");
  assert.deepEqual(pageFailures(page), []);
  assert.deepEqual(sink, []);
});

test("dynamic: younger.html, every state choice and each ?state= link", async () => {
  const page = await loadPage("younger.html");
  await tick(80);
  const sink = [], seen = new Set();
  collect(page.document, "younger.html", "first load", sink, seen);
  const n = await eachOption(page, "younger.html", "yState", sink, seen);
  assert.ok(n > 1, "expected a state list");
  assert.deepEqual(pageFailures(page), []);
  assert.deepEqual(sink, []);
  for (const st of ["ca", "ga", "ny", "il"]) {
    const p = await loadPage("younger.html", { search: "?state=" + st });
    await tick(60);
    collect(p.document, "younger.html", "?state=" + st, sink, seen);
  }
  assert.deepEqual(sink, []);
});

test("dynamic: playbook.html and leaders.html, as loaded and with their buttons pressed", async () => {
  const sink = [], seen = new Set();
  for (const file of ["playbook.html", "leaders.html"]) {
    const page = await loadPage(file);
    await tick(80);
    collect(page.document, file, "first load", sink, seen);
    for (const sel of [...page.document.querySelectorAll("select")]) {
      for (const o of [...sel.options]) {
        type(page.window, sel, o.value);
        await tick(10);
        collect(page.document, file, `#${sel.id}=${o.value}`, sink, seen);
      }
    }
    for (const d of page.document.querySelectorAll("details")) d.open = true;
    collect(page.document, file, "details open", sink, seen);
    assert.deepEqual(pageFailures(page), [], file);
  }
  assert.deepEqual(sink, []);
});
