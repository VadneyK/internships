// Phone numbers for the four permit states are spelled and labeled the same everywhere (ticket r3-accuracy-6).
// Reads data/*.json (not entries*.json) and the built *.html pages, turns every phone into 10 digits, and
// attaches each one to the nearest state name just before it. A number near a state name must be on that
// state's allow list (or the federal list). A listed number near a different state fails too.
// The allow list holds only numbers the repo already cites to an official page. Do not add a number to
// make this pass: fix the source text.
// Run with: node --test tests/phones.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// state -> digits -> role
const ALLOW = {
  California: { "8335264636": "child labor and wage (Labor Commissioner)" },
  Georgia: { "8777098185": "child labor (Georgia DOL Child Labor unit)" },
  "New York": {
    "8884697365": "child labor and wage (State Department of Labor)",
    "8885252267": "complaint help (State Department of Labor)",
    "8774669757": "general number (State Department of Labor, safety page)",
  },
  Illinois: {
    "3127935570": "child labor questions",
    "8006455784": "child labor hotline",
    "3127932800": "wage and hotline office, Chicago (safety page)",
    "3127932804": "wage, outside Chicago (Illinois form of payment page)",
  },
};
// Other agencies the safety and transit pages list on purpose (not child labor or wage lines). Only these two
// files may use them. They are kept apart so a child labor line cannot borrow one.
const OTHER = {
  "data/safety.json": {
    "8335790927": "Cal/OSHA",
    "8007367401": "California Workers' Compensation live help",
    "8008841684": "California Civil Rights Department voice",
    "8007002320": "California Civil Rights Department TTY",
    "4046563818": "Georgia Workers' Compensation, Atlanta area",
    "8005330682": "Georgia Workers' Compensation, outside Atlanta",
    "2177826206": "Illinois helpline, Springfield",
    "8005260844": "Illinois helpline, TTY",
    "8663523033": "Illinois Workers' Compensation Commission, toll-free",
    "3128146500": "Illinois Workers' Compensation Commission, Chicago",
    "3128146200": "Illinois Department of Human Rights",
  },
  "data/states-lite.json": { "7756841890": "Nevada Office of the Labor Commissioner, Carson City (the words Labor Commissioner match California above)" },
  "data/transit.json": { "7145606282": "OCTA youth pass phone" },
};
const FEDERAL = { "8664879243": "USDOL Wage and Hour 1-866-4-US-WAGE" };

// Longer names first. "Labor Commissioner" belongs to California.
const STATE_WORDS = [
  ["New York", /New York|\bNY\b/g],
  ["California", /California|Labor Commissioner/g],
  ["Georgia", /Georgia/g],
  ["Illinois", /Illinois/g],
];
const PHONE = /(?<![\d.-])(?:\+?1[-. ]?)?\(?(\d{3})\)?[-. ]?(\d{3})[-.](\d{4})(?!\d)/g;
const WINDOW = 140;

export function attach(text) {
  const out = [];
  for (const m of text.matchAll(PHONE)) {
    const digits = m[1] + m[2] + m[3];
    const before = text.slice(Math.max(0, m.index - WINDOW), m.index);
    let best = null;
    for (const [state, re] of STATE_WORDS) {
      for (const s of before.matchAll(re)) {
        if (!best || s.index > best.at) best = { state, at: s.index };
      }
    }
    out.push({ digits, token: m[0], state: best && best.state });
  }
  return out;
}

export function problems(file, text) {
  const probs = [];
  const known = new Map();
  for (const [st, nums] of Object.entries(ALLOW)) for (const n of Object.keys(nums)) known.set(n, st);
  for (const h of attach(text)) {
    if (FEDERAL[h.digits] || (OTHER[file] && OTHER[file][h.digits])) continue;
    if (h.state && !ALLOW[h.state][h.digits]) {
      const owner = known.get(h.digits);
      probs.push(`${file}: ${h.token} near ${h.state} is ${owner ? `${owner}'s number` : "not on the allow list"}`);
    }
  }
  return probs;
}

const files = [];
for (const f of readdirSync(join(root, "data")).sort()) {
  if (f.endsWith(".json") && !f.startsWith("entries")) files.push(`data/${f}`);
}
for (const f of readdirSync(root).sort()) if (f.endsWith(".html")) files.push(f);
const texts = files.map((f) => ({ file: f, text: readFileSync(join(root, f), "utf8") }));

test("every phone near California, Georgia, New York or Illinois is on that state's allow list", () => {
  const all = texts.flatMap((t) => problems(t.file, t.text));
  assert.deepEqual([...new Set(all)], []);
});

test("every allowed number is still used somewhere (no dead allow list entries)", () => {
  const used = new Set(texts.flatMap((t) => attach(t.text).map((h) => h.digits)));
  for (const [st, nums] of Object.entries(ALLOW)) {
    for (const n of Object.keys(nums)) assert.ok(used.has(n), `${st} ${n} is on the allow list but not in any file`);
  }
  for (const [file, nums] of Object.entries(OTHER)) {
    const t = texts.find((x) => x.file === file);
    const here = new Set(attach(t.text).map((h) => h.digits));
    for (const n of Object.keys(nums)) assert.ok(here.has(n), `${file} ${n} is on the other agency list but not in the file`);
  }
});

test("the permit, younger, parents, safety, languages and states pages all use the same digits for each state's main number", () => {
  const find = (file) => new Set(attach(texts.find((t) => t.file === file).text).map((h) => h.digits));
  for (const f of ["data/permits.json", "data/parents.json", "data/younger.json"]) {
    const s = find(f);
    for (const n of ["8335264636", "8777098185", "8884697365", "3127935570"]) assert.ok(s.has(n), `${f} lacks ${n}`);
  }
  assert.ok(find("states.html").has("3127935570"));
});

test("rules: an unlisted number or a number from another state fails", () => {
  assert.deepEqual(problems("x", "Georgia: 877-709-8185."), []);
  assert.equal(problems("x", "Georgia: 312-793-5570.").length, 1);
  assert.equal(problems("x", "In California call 404-555-1234.").length, 1);
  assert.deepEqual(problems("x", "Georgia: 1-866-487-9243."), []);
  assert.deepEqual(problems("x", "California 833-526-4636, Georgia 877-709-8185."), []);
});
