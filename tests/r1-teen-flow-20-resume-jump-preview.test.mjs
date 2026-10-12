// Ticket r1-teen-flow-3: on a phone the resume form is one long column. The Build it section has a
// "Jump to the preview and Print" link that points at the preview wrapper (id, tabindex -1), and a
// "Back to the form" link under the preview buttons that points at the form. Both are noprint.
// Run with: node --test tests/r1-teen-flow-20-resume-jump-preview.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage } from "./dom-helper.mjs";

const css = fs.readFileSync(new URL("../assets/css/style.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const JUMP = "Jump to the preview and Print";
const BACK = "Back to the form";

test("resume: the jump link targets the preview wrapper, which has an id and tabindex -1", async () => {
  const { document, errors } = await loadPage("resume.html");
  assert.deepEqual(errors, []);
  const jump = [...document.querySelectorAll("a")].filter((a) => a.textContent.trim() === JUMP);
  assert.equal(jump.length, 1, "jump link appears once");
  assert.ok(jump[0].classList.contains("noprint"), "jump link is noprint");
  const href = jump[0].getAttribute("href");
  assert.match(href, /^#[A-Za-z][\w-]*$/, "jump href is a fragment");
  const target = document.getElementById(href.slice(1));
  assert.ok(target, "jump href resolves to an id on the page");
  assert.equal(target.getAttribute("tabindex"), "-1", "preview wrapper has tabindex -1");
  assert.ok(target.querySelector("#rv"), "the target holds the resume preview");
  assert.ok(target.querySelector("#rPrint"), "the target holds the Print button");
});

test("resume: the back link sits under the preview buttons and points at the form", async () => {
  const { document, errors } = await loadPage("resume.html");
  assert.deepEqual(errors, []);
  const back = [...document.querySelectorAll("a")].filter((a) => a.textContent.trim() === BACK);
  assert.equal(back.length, 1, "back link appears once");
  assert.ok(back[0].classList.contains("noprint"), "back link is noprint");
  const href = back[0].getAttribute("href");
  assert.equal(href, "#rf");
  const form = document.getElementById("rf");
  assert.ok(form && form.tagName === "FORM", "#rf is the form");
  const wrap = document.getElementById("rPreview");
  assert.ok(wrap.contains(back[0]), "back link is inside the preview wrapper");
  const printBtn = document.getElementById("rPrint");
  assert.ok(printBtn.compareDocumentPosition(back[0]) & 4, "back link comes after the Print button");
});

test("resume: the link names are not repeated anywhere on the page", async () => {
  const { document } = await loadPage("resume.html");
  const names = [...document.querySelectorAll("a")].map((a) => a.textContent.trim());
  for (const name of [JUMP, BACK]) {
    assert.equal(names.filter((n) => n === name).length, 1, `"${name}" is unique`);
  }
});

test("style.css hides .noprint in print, so both links leave the paper", () => {
  const m = css.match(/@media print\s*\{([^]*?)\n\}/) || css.match(/@media print\s*\{([^}]*\})/);
  assert.ok(m, "a print block exists");
  assert.match(m[0], /\.noprint[^{]*\{\s*display:\s*none/, ".noprint is display none in print");
});
