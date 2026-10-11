// Right keyboards and spellcheck for the email, phone and name fields on the resume and leaders pages.
// Static parse of the built pages with jsdom: no scripts run, no network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const parse = (file) => new JSDOM(fs.readFileSync(path.join(ROOT, file), "utf8")).window.document;

function field(doc, id) {
  const el = doc.getElementById(id);
  assert.ok(el, `#${id} exists`);
  return el;
}

test("resume: email, phone and name fields use the right keyboard and skip spellcheck", () => {
  const doc = parse("resume.html");
  const form = doc.getElementById("rf");
  assert.ok(form, "#rf exists");
  assert.ok(form.hasAttribute("novalidate"), "#rf keeps novalidate so type=email does not block copy or print");

  const email = field(doc, "rEmail");
  assert.equal(email.getAttribute("type"), "email");
  assert.equal(email.getAttribute("spellcheck"), "false");

  assert.equal(field(doc, "rPhone").getAttribute("type"), "tel");

  for (const id of ["rName", "rCity", "rSchool"]) {
    assert.equal(field(doc, id).getAttribute("spellcheck"), "false", `#${id} spellcheck`);
  }
});

test("resume: every named field keeps autocomplete off and a matching label", () => {
  const doc = parse("resume.html");
  for (const id of ["rName", "rEmail", "rPhone", "rCity", "rSchool"]) {
    const el = field(doc, id);
    assert.equal(el.getAttribute("autocomplete"), "off", `#${id} autocomplete`);
    const label = doc.querySelector(`label[for="${id}"]`);
    assert.ok(label && label.textContent.trim().length > 0, `#${id} has a label`);
  }
});

test("leaders: contact field stays text, is not numeric, and skips spellcheck", () => {
  const doc = parse("leaders.html");
  const el = field(doc, "gContact");
  assert.equal(el.getAttribute("type"), "text");
  assert.notEqual(el.getAttribute("inputmode"), "numeric");
  assert.ok(el.hasAttribute("inputmode"), "inputmode is set");
  assert.equal(el.getAttribute("spellcheck"), "false");
  assert.equal(el.getAttribute("autocomplete"), "off");
  const label = doc.querySelector('label[for="gContact"]');
  assert.ok(label && label.textContent.trim().length > 0, "#gContact has a label");
});
