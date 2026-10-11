// Resume and interview: the reference box and the copy-ready ask script on resume.html.
// Run with: node --test tests/r5-teen-flow-12-resume-reference.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = fs.readFileSync(path.join(ROOT, "src", "resume.html"), "utf8");
const JS = fs.readFileSync(path.join(ROOT, "assets", "js", "resume.js"), "utf8");

const BOX_ID = "who-reference";
const SCRIPT_ID = "refScript";
const DASHES = /[\u2013\u2014]/;

function box(document) {
  return document.getElementById(BOX_ID);
}

function scriptText(document) {
  return document.getElementById(SCRIPT_ID).textContent;
}

test("resume ref box: heading and the eight kinds of people to ask", async () => {
  const { document, errors } = await loadPage("resume.html");
  const b = box(document);
  assert.ok(b, "the reference box exists");
  const h = [...b.querySelectorAll("h3")].find((x) => x.textContent === "Who can be a reference?");
  assert.ok(h, "the box has the heading Who can be a reference?");

  const items = [...b.querySelectorAll("li")].map((li) => li.textContent.trim());
  assert.deepEqual(items, [
    "A teacher",
    "A coach",
    "A school counselor",
    "A club advisor",
    "A volunteer supervisor",
    "A family you babysit for",
    "A neighbor you do yard work for",
    "A youth leader or church leader"
  ]);
  assert.deepEqual(errors, []);
});

test("resume ref box: a parent or relative should not be the only reference, and the box says these are tips", async () => {
  const { document } = await loadPage("resume.html");
  const text = box(document).textContent;
  assert.ok(text.includes("A parent or relative should not be your only reference."));
  assert.ok(text.includes("These are tips, not facts about the law."));
});

test("resume ref script: exactly three sentences with the required parts", async () => {
  const { document } = await loadPage("resume.html");
  const text = scriptText(document).trim();
  const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean);
  assert.equal(sentences.length, 3, "three sentences: " + JSON.stringify(sentences));

  // Sentence 1: who you are and the exact job.
  assert.match(sentences[0], /\[your name\]/);
  assert.match(sentences[0], /\[exact job title\]/);
  // Sentence 2 and 3: the question and the permission to say no.
  assert.equal(sentences[1], "Would you be comfortable being a reference for me?");
  assert.equal(sentences[2], "It is fine to say no.");
});

test("resume ref script: the copy button uses the data-copy pattern and points at the script", async () => {
  const { document } = await loadPage("resume.html");
  const btn = document.querySelector("button[data-copy]");
  assert.ok(btn, "a data-copy button exists");
  assert.equal(btn.getAttribute("data-copy"), SCRIPT_ID);
  assert.equal(btn.textContent.trim(), "Copy the script");
  assert.ok(document.getElementById(SCRIPT_ID), "the target element exists");
});

test("resume ref script: clicking Copy puts the script text on the clipboard and says Copied", async () => {
  const { window, document, errors } = await loadPage("resume.html");
  let copied = null;
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: (t) => { copied = t; return Promise.resolve(); } },
    configurable: true
  });

  document.querySelector("button[data-copy='refScript']").click();
  await tick();

  assert.equal(copied, scriptText(document));
  assert.equal(document.getElementById("toast").textContent, "Copied");
  assert.deepEqual(errors, []);
});

test("resume ref box: no em dash or en dash in the page source, the script or the box text", async () => {
  assert.doesNotMatch(SRC, DASHES, "resume.html has a dash character");
  assert.doesNotMatch(JS, DASHES, "resume.js has a dash character");
  const { document } = await loadPage("resume.html");
  assert.doesNotMatch(box(document).textContent, DASHES);
});

test("resume ref box: the box is in the page source with the copy script and no undefined or null text", async () => {
  assert.match(SRC, /id="who-reference"/);
  assert.match(SRC, /data-copy="refScript"/);
  const { document } = await loadPage("resume.html");
  assert.doesNotMatch(box(document).textContent, /undefined|null|\[object|NaN/);
});
