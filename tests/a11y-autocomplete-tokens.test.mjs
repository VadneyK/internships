// Run with: node --test tests/a11y-autocomplete-tokens.test.mjs
// WCAG 1.3.5 (Identify Input Purpose). The teen's own fields carry the matching autocomplete token, so the browser can
// offer the saved value. Autofill stays on the device. Reads the built root pages (run python3 tools/build.py first).
// Part 1: the teen's own fields have their exact token.
// Part 2: every other text input on these pages is on autocomplete="off" and listed by id below. A new field must be added
// here on purpose, so a personal field cannot ship with the wrong token, and no token can sneak onto someone else's field.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = ["permit.html", "interview.html", "playbook.html", "resume.html"];

// The teen's own details: page, field id, required token.
const PERSONAL = [
  ["permit.html", "mName", "given-name"],
  ["interview.html", "tName", "given-name"],
  ["playbook.html", "fMe", "given-name"],
  ["resume.html", "rName", "name"],
  ["resume.html", "rEmail", "email"],
  ["resume.html", "rPhone", "tel"],
  ["resume.html", "rCity", "address-level2"],
];

// Text fields that stay on "off": other people's names, the employer, the wage and group details.
// Each one is a field about someone else, or a field whose value must not be offered as a saved value.
const STAYS_OFF = {
  "permit.html": ["mEmp"],
  "interview.html": ["tTo", "tJob", "tHelp"],
  "playbook.html": ["fTo", "fGrade", "fSchool", "fCurious", "fWhen"],
  "resume.html": ["rSchool", "rGrad", "rEduNote", "rSkills", "rAwards"],
};

const TEXT_TYPES = new Set(["text", "email", "tel", "search", "url"]);

const docs = new Map();
function doc(file) {
  if (!docs.has(file)) {
    const html = fs.readFileSync(path.join(ROOT, file), "utf8");
    docs.set(file, new JSDOM(html).window.document);
  }
  return docs.get(file);
}

function textInputs(file) {
  return [...doc(file).querySelectorAll("input")].filter((el) => TEXT_TYPES.has((el.getAttribute("type") || "text").toLowerCase()));
}

test("the teen's own fields have their autocomplete token", () => {
  for (const [file, id, token] of PERSONAL) {
    const el = doc(file).getElementById(id);
    assert.ok(el, `${file} has no #${id}`);
    assert.equal(el.getAttribute("autocomplete"), token, `${file} #${id} should have autocomplete="${token}"`);
  }
});

test("every other text input stays on autocomplete=off, and the list is complete", () => {
  for (const file of PAGES) {
    const personal = new Set(PERSONAL.filter(([f]) => f === file).map(([, id]) => id));
    const off = textInputs(file).filter((el) => !personal.has(el.id)).map((el) => el.id || "(no id)");
    const expected = STAYS_OFF[file] || [];
    assert.deepEqual(off.sort(), [...expected].sort(), `${file}: text inputs on other autocomplete values or unlisted. Update STAYS_OFF on purpose.`);
    for (const el of textInputs(file)) {
      if (personal.has(el.id)) continue;
      assert.equal(el.getAttribute("autocomplete"), "off", `${file} #${el.id} should be off`);
    }
  }
});

test("no personal token appears on a field about someone else", () => {
  const others = ["fTo", "tTo", "mEmp", "tJob", "tHelp", "rSchool", "rGrad"];
  for (const file of PAGES) {
    for (const id of others) {
      const el = doc(file).getElementById(id);
      if (!el) continue;
      const token = el.getAttribute("autocomplete");
      assert.ok(token === null || token === "off", `${file} #${id} must not carry a personal token (found "${token}")`);
    }
  }
});
