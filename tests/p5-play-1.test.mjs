// p5-play-1: two sample messages on the playbook, one to a researcher or lab and one asking a teacher for a recommendation letter.
// Run with: node --test tests/p5-play-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const NEW = [
  { id: "t7", summary: "Template: a researcher or lab" },
  { id: "t8", summary: "Template: a teacher for a recommendation letter" },
];

function templateFor(document, summary) {
  const det = [...document.querySelectorAll("#send details.acc")].find((d) => d.querySelector("summary").textContent.trim() === summary);
  return det || null;
}

test("p5-play-1: both new sample messages appear in the send section with a Copy button", async () => {
  const { document, errors } = await loadPage("playbook.html");
  assert.deepEqual(errors, []);
  for (const t of NEW) {
    const det = templateFor(document, t.summary);
    assert.ok(det, `"${t.summary}" is a template in #send`);
    const letter = det.querySelector("p.letter");
    assert.ok(letter, `${t.summary} has a p.letter`);
    assert.equal(letter.id, t.id);
    const copy = det.querySelector("button[data-copy]");
    assert.ok(copy, `${t.summary} has a Copy button`);
    assert.equal(copy.getAttribute("data-copy"), t.id);
  }
});

test("p5-play-1: the researcher message asks a short question and keeps its blanks", async () => {
  const { document } = await loadPage("playbook.html");
  const text = document.getElementById("t7").textContent;
  assert.match(text, /^Hi \[their name\], my name is \[your first name\]/);
  assert.match(text, /\[topic\]/);
  assert.match(text, /one short question/);
  assert.match(text, /Totally fine if you're busy/);
  assert.match(text, /Thank you/);
});

test("p5-play-1: the recommendation message asks four weeks ahead and offers a one-page list", async () => {
  const { document } = await loadPage("playbook.html");
  const text = document.getElementById("t8").textContent;
  assert.match(text, /recommendation letter/);
  assert.match(text, /four weeks before it is due/);
  assert.match(text, /one-page list of what I did/);
  assert.match(text, /If you can't do it, that's completely okay/);
  assert.match(text, /\[teacher's name\]/);
});

test("p5-play-1: both messages are short and plain, with no dash characters", async () => {
  const { document } = await loadPage("playbook.html");
  for (const t of NEW) {
    const text = document.getElementById(t.id).textContent;
    const words = (text.match(/\S+/g) || []).length;
    assert.ok(words > 20 && words <= 90, `${t.id} is ${words} words (want 21 to 90)`);
    assert.doesNotMatch(text, /[\u2013\u2014]/, `${t.id} has an en or em dash`);
    assert.doesNotMatch(text, /\[object/);
  }
});

test("p5-play-1: Copy on each new message copies that message's text", async () => {
  const copied = [];
  const setup = (w) => {
    Object.defineProperty(w.navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { copied.push(t); } } });
  };
  const { document, errors } = await loadPage("playbook.html", { setup });
  for (const t of NEW) {
    document.querySelector(`button[data-copy="${t.id}"]`).click();
    await tick(20);
    assert.equal(copied.at(-1), document.getElementById(t.id).textContent, `${t.id} Copy copies its text`);
  }
  assert.deepEqual(errors, []);
});

test("p5-play-1: the builder still builds a message with the same fields after the new templates", async () => {
  const { window, document } = await loadPage("playbook.html");
  const type = (el, v) => { el.value = v; el.dispatchEvent(new window.Event("input", { bubbles: true })); };
  type(document.getElementById("fTo"), "Dr. Patel");
  type(document.getElementById("fMe"), "Maya");
  type(document.getElementById("fHow"), "I'm in your summer lab group.");
  type(document.getElementById("fCurious"), "water testing");
  await tick();
  const letter = document.getElementById("letter").textContent;
  assert.match(letter, /Hi Dr\. Patel,/);
  assert.match(letter, /My name is Maya/);
  assert.match(letter, /I'm curious about water testing\./);
  assert.match(letter, /Totally fine if you're busy/);
});
