// p5-younger-1: "Work you can start this week near home" on younger.html lists 4 federal-rule jobs, each with a source link that exists in the data files.
// Run with: node --test tests/p5-younger-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const younger = JSON.parse(fs.readFileSync(path.join(ROOT, "data/younger.json"), "utf8"));
const employers = fs.readFileSync(path.join(ROOT, "data/employers.json"), "utf8");
const youngerRaw = fs.readFileSync(path.join(ROOT, "data/younger.json"), "utf8");

test("p5-younger-1: the section has a heading, a note, 4 work lines and a neighbor script", async () => {
  const { document, errors } = await loadPage("younger.html"); await tick(200);
  assert.deepEqual(errors, []);
  const h = document.getElementById("nearH");
  assert.ok(h, "heading exists");
  assert.equal(h.textContent, "Work you can start this week near home");
  assert.ok(document.getElementById("earn").contains(h), "section sits in the earning ideas part of the page, above the state grid (r2 younger ticket)");
  assert.ok(document.getElementById("nearNote").textContent.length > 0, "note is filled in");
  const items = document.querySelectorAll("#nearL li");
  assert.equal(items.length, 4, `4 lines, got ${items.length}`);
  assert.match(document.getElementById("nearScript").textContent, /\[your first name\]/);
});

test("p5-younger-1: every work line has a source link that goes to https", async () => {
  const { document } = await loadPage("younger.html"); await tick(200);
  for (const li of document.querySelectorAll("#nearL li")) {
    const a = li.querySelector("a");
    assert.ok(a, `line has a source link: ${li.textContent}`);
    assert.match(a.getAttribute("href"), /^https:\/\//);
    assert.ok(a.textContent.trim().length > 0, "link has text");
    assert.match(li.textContent, /stricter/, "each line carries the state caveat");
  }
});

test("p5-younger-1: every source link is an existing source in data/younger.json or data/employers.json (no new facts)", async () => {
  const { document } = await loadPage("younger.html"); await tick(200);
  for (const item of younger.near.items) {
    assert.ok(item.s && item.s.t && item.s.u, `item has a source: ${item.t}`);
    const known = youngerRaw.includes(item.s.u) || employers.includes(item.s.u);
    assert.ok(known, `source url is in the data files: ${item.s.u}`);
  }
  for (const a of document.querySelectorAll("#nearL li a")) {
    assert.ok(youngerRaw.includes(a.href) || employers.includes(a.href), `rendered link is sourced: ${a.href}`);
  }
});

test("p5-younger-1: the section has no dash characters and no pet care line (no official source names it)", async () => {
  const { document } = await loadPage("younger.html"); await tick(200);
  const text = document.getElementById("near").textContent;
  assert.doesNotMatch(text, new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]"));
  assert.doesNotMatch(text, /\bpet\b|\bdog\b/i);
  assert.doesNotMatch(text, /undefined|NaN/);
});
