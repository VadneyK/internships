import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type } from "./dom-helper.mjs";

// The resume builder starts with the example name and email. The rExample note warns while either is still the example.
function note(document) {
  return document.getElementById("rExample");
}

test("resume example note: is a status paragraph beside Print and Copy and is visible at load", async () => {
  const { document, errors } = await loadPage("resume.html");
  const n = note(document);
  assert.ok(n, "rExample exists");
  assert.equal(n.tagName, "P");
  assert.equal(n.getAttribute("role"), "status");
  assert.equal(n.hidden, false);
  assert.match(n.textContent, /still shows the example name and email/);
  assert.match(n.textContent, /Put in your own details before you print, copy or send it/);
  assert.equal(n.previousElementSibling, document.getElementById("rPrint").parentElement);
  assert.deepEqual(errors, []);
});

test("resume example note: stays visible while only the name is changed", async () => {
  const { window, document, errors } = await loadPage("resume.html");
  type(window, document.getElementById("rName"), "Jordan Lee");
  assert.equal(note(document).hidden, false, "email still the example");
  assert.deepEqual(errors, []);
});

test("resume example note: stays visible while only the email is changed", async () => {
  const { window, document, errors } = await loadPage("resume.html");
  type(window, document.getElementById("rEmail"), "jordan@example.org");
  assert.equal(note(document).hidden, false, "name still the example");
  assert.deepEqual(errors, []);
});

test("resume example note: hides once both the name and email are changed", async () => {
  const { window, document, errors } = await loadPage("resume.html");
  type(window, document.getElementById("rName"), "Jordan Lee");
  type(window, document.getElementById("rEmail"), "jordan@example.org");
  assert.equal(note(document).hidden, true);
  assert.deepEqual(errors, []);
});

test("resume example note: reappears if the name is put back to the example", async () => {
  const { window, document, errors } = await loadPage("resume.html");
  type(window, document.getElementById("rName"), "Jordan Lee");
  type(window, document.getElementById("rEmail"), "jordan@example.org");
  type(window, document.getElementById("rName"), "Alex Rivera");
  assert.equal(note(document).hidden, false);
  assert.deepEqual(errors, []);
});

test("resume example note: Clear the example hides it and Print and Copy still run", async () => {
  const { window, document, errors } = await loadPage("resume.html");
  document.getElementById("rClear").click();
  assert.equal(note(document).hidden, true);

  let copied = null;
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: (t) => { copied = t; return Promise.resolve(); } },
    configurable: true
  });
  document.getElementById("rCopy").click();
  assert.equal(typeof copied, "string");

  window.print = () => {};
  document.getElementById("rPrint").click();
  window.dispatchEvent(new window.Event("afterprint"));
  assert.deepEqual(errors, []);
});

test("resume example note: a saved draft with changed name and email starts with the note hidden", async () => {
  const raw = JSON.stringify({ rName: "Jordan Lee" });
  const b = await loadPage("resume.html", { rawStorage: { resume: raw } });
  // The restored draft has a changed name and a blank email (email is never saved), so no example is left and the note stays hidden.
  assert.equal(note(b.document).hidden, true);
  type(b.window, b.document.getElementById("rName"), "Alex Rivera");
  assert.equal(note(b.document).hidden, false, "name back to the example shows the note");
  assert.deepEqual(b.errors, []);
});

test("resume example note: fresh page with example values shows the note", async () => {
  const { document, errors } = await loadPage("resume.html");
  assert.equal(document.getElementById("rName").value, "Alex Rivera");
  assert.equal(document.getElementById("rEmail").value, "alex.rivera@example.com");
  assert.equal(note(document).hidden, false);
  assert.deepEqual(errors, []);
});
