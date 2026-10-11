// Phone keyboards: name boxes start with a capital, email and phone stay plain. Checks built pages and JS-built rows.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

const WORDS = {
  "playbook.html": ["fTo", "fMe", "pn0", "pn1"],
  "interview.html": ["tTo", "tName", "rn0", "rn1"],
  "permit.html": ["mName"],
  "resume.html": ["rName"],
};
const FREE = { "playbook.html": ["pw0", "ph0"], "interview.html": ["rw0", "rc0"] };

for (const [file, ids] of Object.entries(WORDS)) {
  test(file + " name inputs capitalize words", async () => {
    const { window } = await loadPage(file);
    const d = window.document;
    for (const id of ids) {
      const el = d.getElementById(id);
      assert.ok(el, id + " exists");
      assert.equal(el.getAttribute("autocapitalize"), "words", id);
    }
    for (const id of FREE[file] || []) {
      const el = d.getElementById(id);
      assert.ok(el, id + " exists");
      assert.equal(el.getAttribute("autocapitalize"), null, id + " stays default");
    }
    for (const el of d.querySelectorAll("input[autocomplete]")) assert.ok(el.getAttribute("autocomplete"), (el.id || "input") + " keeps autocomplete");
    window.close();
  });
}

test("playbook rows added by the button carry autocapitalize", async () => {
  const { window } = await loadPage("playbook.html");
  const d = window.document;
  for (let i = 0; i < 3; i++) d.getElementById("addPerson").click();
  const last = d.querySelectorAll('input[data-k="n"]');
  assert.ok(last.length >= 6);
  for (const el of last) assert.equal(el.getAttribute("autocapitalize"), "words", el.id);
  window.close();
});

test("resume email and phone stay plain", async () => {
  const { window } = await loadPage("resume.html");
  const d = window.document;
  const e = d.getElementById("rEmail"), p = d.getElementById("rPhone");
  assert.equal(e.getAttribute("autocapitalize"), "none");
  assert.equal(e.getAttribute("spellcheck"), "false");
  assert.equal(e.getAttribute("autocomplete"), "email");
  assert.equal(p.getAttribute("inputmode"), "tel");
  assert.equal(p.getAttribute("autocapitalize"), "none");
  assert.equal(p.getAttribute("autocomplete"), "tel");
  window.close();
});
