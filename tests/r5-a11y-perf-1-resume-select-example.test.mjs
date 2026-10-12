// Resume: an untouched example value is selected on first focus, so the first keystroke replaces it.
// Typed text and restored drafts are never selected. Run with: node --test tests/r5-a11y-perf-1-resume-select-example.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

const FIELDS = ["rName", "rEmail", "rPhone", "rCity", "rSchool"];

// Counts calls to select() on any input in the page window. Returns the counter object.
function spySelect(window) {
  const proto = window.HTMLInputElement.prototype;
  const original = proto.select;
  const counter = { n: 0, byId: {} };
  proto.select = function (...args) {
    counter.n++;
    counter.byId[this.id] = (counter.byId[this.id] || 0) + 1;
    return original.apply(this, args);
  };
  return counter;
}

test("resume: each example field is selected once on first focus while it still has its shipped value", async () => {
  const { window, document, errors } = await loadPage("resume.html");
  const counter = spySelect(window);

  for (const id of FIELDS) {
    const el = document.getElementById(id);
    assert.equal(el.value, el.defaultValue, id + " starts with its shipped value");
    el.focus();
    assert.equal(document.activeElement, el, id + " took focus");
  }

  assert.equal(counter.n, FIELDS.length, "select called once per field: " + JSON.stringify(counter.byId));
  for (const id of FIELDS) assert.equal(counter.byId[id], 1, id + " selected once");
  assert.deepEqual(errors, []);
});

test("resume: a field the teen typed into is not selected on focus", async () => {
  const { window, document } = await loadPage("resume.html");
  const counter = spySelect(window);

  const name = document.getElementById("rName");
  name.value = "Maya Lee";
  name.dispatchEvent(new window.Event("input", { bubbles: true }));
  name.blur();
  name.focus();

  assert.equal(counter.n, 0, "select not called for typed text");
  assert.equal(name.value, "Maya Lee");
});

test("resume: a restored draft with a changed name is not selected on focus", async () => {
  const { window, document } = await loadPage("resume.html", {
    storage: { resume: { rName: "Jordan Ko", rCity: "Oakland, CA" } }
  });
  const counter = spySelect(window);

  assert.equal(document.getElementById("rKeep").checked, true, "draft restored");
  assert.equal(document.getElementById("rName").value, "Jordan Ko");

  document.getElementById("rName").focus();

  assert.equal(counter.n, 0, "select not called for a restored, changed name");
});

test("resume: selecting an example on focus does not write any storage key", async () => {
  const { window, document } = await loadPage("resume.html");
  const before = window.localStorage.length;
  const keysBefore = Object.keys(window.localStorage);

  for (const id of FIELDS) document.getElementById(id).focus();

  assert.equal(window.localStorage.length, before, "no new storage keys");
  assert.deepEqual(Object.keys(window.localStorage), keysBefore);
});
