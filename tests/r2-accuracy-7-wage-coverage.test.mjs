// Every dollar amount (and "Jan 1, 2027" mention) in the California pay text of rules.html and in each
// state section of states.html must also appear in the matching card: permits.json states.<id>.wage,
// or money.json (presets, gaps, notes). A fact that lives on only one surface fails by page, state, amount.
// Run with: node --test tests/r2-accuracy-7-wage-coverage.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const permits = JSON.parse(read("data/permits.json"));
const money = JSON.parse(read("data/money.json"));

const allStrings = (node, out = []) => {
  if (typeof node === "string") out.push(node);
  else if (typeof node === "number") out.push(String(node));
  else if (Array.isArray(node)) node.forEach((n) => allStrings(n, out));
  else if (node && typeof node === "object") Object.values(node).forEach((v) => allStrings(v, out));
  return out;
};
// Normalize "$16.90", "16.9" and "$17" to one number string.
const norm = (s) => String(Number(s.replace(/[$,]/g, "")));
const amountsIn = (text) => [...text.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g)].map((m) => norm(m[1]));
const hasJan2027 = (text) => /\b(?:Jan(?:uary|\.)?)\s+1,\s+2027/i.test(text);

const moneyText = allStrings([money.presets, money.gaps, money.lineNotes, money.parentNote, money.wrongNote, money.rateSources, money.fileNote]).join("\n");
const moneyNums = new Set([...amountsIn(moneyText), ...money.presets.map((p) => norm(String(p.wage)))]);

// Amounts that are intentionally page-only. Key: "<page>|<state>|<amount>", value: the reason.
const ALLOW = {
  "states.html|ga|5.15": "Georgia's own rate, which applies only to the few employers federal law does not cover. The card gives the $7.25 that applies to nearly everyone.",
  "rules.html|ca|400": "Self-employment tax threshold, not a wage figure.",
  "rules.html|ca|17.34": "City table: Oakland. City rates are listed on the rules page only; permits.json says to ask the employer.",
  "rules.html|ca|17.76": "City table: Alameda.",
  "rules.html|ca|18.05": "City table: Fremont.",
  "rules.html|ca|18.45": "City table: San Jose.",
  "rules.html|ca|18.7": "City table: Palo Alto.",
  "rules.html|ca|19.5": "City table: Sunnyvale.",
  "rules.html|ca|19.7": "City table: Mountain View.",
  "rules.html|ca|19.61": "City table: Berkeley and San Francisco.",
  "rules.html|ca|20.34": "City table: Emeryville.",
};

const sectionText = (doc, id) => {
  const el = doc.getElementById(id);
  assert.ok(el, `section #${id} exists`);
  return el.textContent.replace(/\s+/g, " ");
};

const surfaces = [];
{
  const rules = new JSDOM(read("src/rules.html")).window.document;
  surfaces.push({ page: "rules.html", state: "ca", text: [sectionText(rules, "pay"), rules.querySelector("main")?.textContent.replace(/\s+/g, " ") || ""].join(" ") });
  const states = new JSDOM(read("src/states.html")).window.document;
  for (const [id, state] of [["georgia", "ga"], ["newyork", "ny"], ["illinois", "il"]]) {
    surfaces.push({ page: "states.html", state, text: sectionText(states, id) });
  }
}

for (const { page, state, text } of surfaces) {
  const wage = permits.states[state].wage;
  const wageNums = new Set(amountsIn(wage));
  test(`${page} (${state}): every dollar amount is on the card`, () => {
    const missing = [];
    for (const amt of new Set(amountsIn(text))) {
      if (wageNums.has(amt) || moneyNums.has(amt)) continue;
      if (ALLOW[`${page}|${state}|${amt}`]) continue;
      missing.push(`$${amt}`);
    }
    assert.deepEqual(missing, [], `${page} (${state}): amount not in permits.json states.${state}.wage or money.json, and not on the allow list: ${missing.join(", ")}`);
  });
  test(`${page} (${state}): a 'Jan 1, 2027' mention is also on the card`, () => {
    if (!hasJan2027(text) && !/January 1, 2027/.test(text)) return;
    assert.ok(/2027/.test(wage), `${page} (${state}) mentions Jan 1, 2027 but permits.json states.${state}.wage does not mention 2027`);
  });
}

test("allow list entries are still needed", () => {
  for (const key of Object.keys(ALLOW)) {
    const [page, state, amt] = key.split("|");
    const s = surfaces.find((x) => x.page === page && x.state === state);
    assert.ok(s && amountsIn(s.text).includes(amt), `allow list entry ${key} no longer appears on the page; remove it`);
  }
});
