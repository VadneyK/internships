// Heading order in every picker state, not just one. The r1 heading test checks each page once; this one
// picks every choice a picker offers and checks the headings after each pick.
// A screen reader user moves by heading, so there must be one h1, no skipped level, and no empty heading.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

const HEADINGS = "h1, h2, h3, h4, h5, h6";

// Headings in document order that a user can reach: skips anything inside a [hidden] subtree.
// Same walk as tests/r1-a11y-perf-6-rendered-headings.test.mjs.
function walk(document) {
  return [...document.querySelectorAll(HEADINGS)]
    .filter((h) => !h.closest("[hidden]"))
    .map((h) => ({ level: Number(h.tagName[1]), text: (h.textContent || "").trim(), html: h.outerHTML.slice(0, 90) }));
}

// Same problem rules as tests/r1-a11y-perf-6-rendered-headings.test.mjs.
function problems(list) {
  const out = [];
  const h1s = list.filter((h) => h.level === 1).length;
  if (h1s !== 1) out.push(`found ${h1s} h1 elements`);
  let prev = 0;
  for (const h of list) {
    if (prev && h.level > prev + 1) out.push(`h${prev} is followed by h${h.level}: ${h.html}`);
    if (!h.text) out.push(`empty heading: ${h.html}`);
    prev = h.level;
  }
  return out;
}

// Problems for one picker state, each tagged with the state so a failure names it.
function stateProblems(document, label) {
  return problems(walk(document)).map((p) => `${label}: ${p}`);
}

// The values of a picker's options, leaving out the empty "any" choice.
function optionValues(document, id) {
  return [...document.getElementById(id).options].map((o) => o.value).filter((v) => v !== "");
}

// Loads a page once, then applies each pick in order on that same page, checking headings after every pick.
// picks(page) returns [{ label, apply }]. The start state is checked too.
function checkStates(name, file, picks) {
  test(name, async () => {
    const page = await loadPage(file);
    await tick(150);
    const found = stateProblems(page.document, "start");
    for (const pick of picks(page)) {
      pick.apply();
      found.push(...stateProblems(page.document, pick.label));
    }
    await tick(100);
    assert.deepEqual(page.errors, [], "page errors");
    assert.deepEqual(found, []);
  });
}

// jobs.html: under 14 draws a card with h3, 14 to 18 draw a second set of h3s for the start-older details.
const JOB_AGES = ["u14", "14", "15", "16", "17", "18"];
test("jobs.html: the age picker offers exactly the six choices", async () => {
  const { document } = await loadPage("jobs.html");
  await tick(150);
  assert.deepEqual(optionValues(document, "jAge"), JOB_AGES);
});
checkStates("jobs.html: headings for every age choice (under 14, 14 to 18)", "jobs.html", ({ window, document }) =>
  JOB_AGES.map((age) => ({
    label: `jAge ${age}`,
    apply: () => type(window, document.getElementById("jAge"), age),
  })));

// permit.html: three state, age and kind combinations the page offers. They draw different answer cards.
const PERMIT_CASES = [
  ["ca", "12", "job"],
  ["ga", "15", "job"],
  ["il", "17", "volunteer"],
];
checkStates("permit.html: headings for three state, age and kind combinations", "permit.html", ({ window, document }) =>
  PERMIT_CASES.map(([st, age, kind]) => ({
    label: `permit ${st} ${age} ${kind}`,
    apply: () => {
      type(window, document.getElementById("pState"), st);
      type(window, document.getElementById("pAge"), age);
      type(window, document.getElementById("pKind"), kind);
    },
  })));

// paycheck.html: every preset in the pick box, one after another (a pick also chooses the state in the second box).
test("paycheck.html: headings after every preset is picked", async () => {
  const { window, document, errors } = await loadPage("paycheck.html");
  await tick(150);
  const presets = optionValues(document, "mPreset");
  assert.ok(presets.length >= 2, "paycheck presets are loaded");
  const found = stateProblems(document, "start");
  for (const id of presets) {
    type(window, document.getElementById("mPreset"), id);
    found.push(...stateProblems(document, `mPreset ${id}`));
  }
  await tick(100);
  assert.deepEqual(errors, [], "page errors");
  assert.deepEqual(found, []);
});

// states.html: every non-empty state in the picker, one after another.
test("states.html: headings after every state is picked", async () => {
  const { window, document, errors } = await loadPage("states.html");
  await tick(150);
  const states = optionValues(document, "moreSel");
  assert.ok(states.length >= 2, "state options are loaded");
  const found = stateProblems(document, "start");
  for (const st of states) {
    type(window, document.getElementById("moreSel"), st);
    found.push(...stateProblems(document, `moreSel ${st}`));
  }
  await tick(100);
  assert.deepEqual(errors, [], "page errors");
  assert.deepEqual(found, []);
});

// languages.html: every language in the language picker, one after another.
test("languages.html: headings after every language is picked", async () => {
  const { window, document, errors } = await loadPage("languages.html");
  await tick(150);
  const langs = optionValues(document, "lLang");
  assert.ok(langs.length >= 2, "language options are loaded");
  const found = stateProblems(document, "start");
  for (const lang of langs) {
    type(window, document.getElementById("lLang"), lang);
    found.push(...stateProblems(document, `lLang ${lang}`));
  }
  await tick(100);
  assert.deepEqual(errors, [], "page errors");
  assert.deepEqual(found, []);
});

// interview.html: every age and state the availability picker offers, each combination in turn.
test("interview.html: headings for every age and state combination in the availability picker", async () => {
  const { window, document, errors } = await loadPage("interview.html");
  await tick(150);
  const ages = optionValues(document, "aAge");
  const states = optionValues(document, "aState");
  assert.ok(ages.length >= 2 && states.length >= 2, "availability pickers are loaded");
  const found = stateProblems(document, "start");
  for (const age of ages) {
    for (const st of states) {
      type(window, document.getElementById("aAge"), age);
      type(window, document.getElementById("aState"), st);
      found.push(...stateProblems(document, `aAge ${age} aState ${st}`));
    }
  }
  await tick(100);
  assert.deepEqual(errors, [], "page errors");
  assert.deepEqual(found, []);
});
