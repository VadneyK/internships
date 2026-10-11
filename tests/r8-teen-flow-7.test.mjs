// Ticket r1-teen-flow-7: every permit, jobs, younger and paycheck link in the built pages
// uses a state, kind or age that the target page accepts. A bad value would open a blank picker.
// Run with: node --test tests/r8-teen-flow-7.test.mjs
//
// Skip rule (dynamic fragments): in a JS string like 'permit.html?state=' + st + "&kind=" + pk,
// a parameter whose value is empty in the literal (nothing after "=") is built from a variable,
// so it cannot be checked here and is skipped. Literal pieces that come later in the same link
// (for example "&age=15&kind=job") are still checked. Each link is read up to the end of its
// line or the next "</a>".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

const permits = readJson("data/permits.json");
const younger = readJson("data/younger.json");
const money = readJson("data/money.json");
const okPermitStates = new Set(Object.keys(permits.states));
const okKinds = new Set(permits.kinds.map((k) => k[0]));
const okYoungerStates = new Set(younger.states.map((s) => s[0]));
const okMoneyStates = new Set(money.states.map((s) => s.id));
const inRange = (v, lo, hi) => /^\d+$/.test(v) && +v >= lo && +v <= hi;

const rules = {
  permit: {
    state: (v) => okPermitStates.has(v),
    kind: (v) => okKinds.has(v),
    age: (v) => inRange(v, 12, 18),
  },
  jobs: { age: (v) => v === "u14" || inRange(v, 12, 18) },
  younger: { state: (v) => okYoungerStates.has(v), age: (v) => inRange(v, 12, 14) },
  paycheck: { state: (v) => okMoneyStates.has(v) },
};

function sources() {
  const out = [];
  for (const f of fs.readdirSync(root)) if (f.endsWith(".html")) out.push(f);
  const js = path.join(root, "assets/js");
  for (const f of fs.readdirSync(js)) if (f.endsWith(".js")) out.push("assets/js/" + f);
  return out;
}

// Returns [{file, page, name, value}] for every literal (non-empty) parameter value found.
export function collect(text, file) {
  const found = [];
  const re = /\b(permit|jobs|younger|paycheck)\.html\?/g;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length;
    let end = text.indexOf("\n", start);
    if (end < 0) end = text.length;
    const close = text.indexOf("</a>", start);
    if (close >= 0 && close < end) end = close;
    const seg = text.slice(start, end);
    const pr = /(?:^|[&?])(state|kind|age)=([A-Za-z0-9_-]*)/g;
    let p;
    while ((p = pr.exec(seg))) {
      if (p[2] === "") continue; // dynamic: value comes from a variable
      found.push({ file, page: m[1], name: p[1], value: p[2] });
    }
  }
  return found;
}

test("every literal permit, jobs, younger and paycheck link value is one the target page accepts", () => {
  const links = sources().flatMap((f) => collect(fs.readFileSync(path.join(root, f), "utf8"), f));
  assert.ok(links.length > 0, "found zero checkable links, so the test would pass empty");
  const bad = [];
  for (const l of links) {
    const check = rules[l.page][l.name];
    if (!check) bad.push(`${l.file}: ${l.page}.html does not take "${l.name}" (${l.value})`);
    else if (!check(l.value)) bad.push(`${l.file}: ${l.page}.html?${l.name}=${l.value} is not accepted`);
  }
  assert.deepEqual(bad, []);
});

test("the collector reads literal pieces and skips variable ones", () => {
  const got = collect(`href="permit.html?state=' + st + "&kind=" + pk`, "x").length;
  assert.equal(got, 0);
  const lit = collect(`<a href="permit.html?state=zz&age=15&kind=job">x</a>`, "x");
  assert.equal(lit.length, 3);
  assert.equal(rules.permit.state(lit[0].value), false);
});
