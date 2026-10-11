// After scripts draw cards, tables and forms, ids stay unique, aria references resolve, and every control keeps a name.
// Runs on every built root page, then again after one interaction on resume, playbook, permit, paycheck and find.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

const txt = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
function refText(doc, ids) {
  return ids.split(/\s+/).filter(Boolean).map((i) => { const e = doc.getElementById(i); return e ? txt(e) : ""; }).join(" ").trim();
}
function imgAlts(el) { return [...el.querySelectorAll("img[alt]")].map((i) => i.getAttribute("alt").trim()).join(" ").trim(); }
function nameOf(doc, el) {
  const lb = el.getAttribute("aria-labelledby");
  if (lb && refText(doc, lb)) return refText(doc, lb);
  const al = (el.getAttribute("aria-label") || "").trim();
  if (al) return al;
  const t = txt(el) || imgAlts(el);
  if (t) return t;
  return (el.getAttribute("title") || "").trim();
}
function hasLabel(doc, el) {
  if (el.getAttribute("aria-label") && el.getAttribute("aria-label").trim()) return true;
  const lb = el.getAttribute("aria-labelledby");
  if (lb && refText(doc, lb)) return true;
  if (el.id) {
    for (const l of doc.querySelectorAll("label[for]")) if (l.getAttribute("for") === el.id && txt(l)) return true;
  }
  const w = el.closest("label");
  return !!(w && txt(w));
}

function audit(f, doc, when) {
  const at = f + " (" + when + "): ";
  const bad = [];
  // duplicate ids
  const seen = new Map();
  for (const e of doc.querySelectorAll("[id]")) seen.set(e.id, (seen.get(e.id) || 0) + 1);
  for (const [id, n] of seen) if (n > 1) bad.push("duplicate id " + id + " x" + n);
  // aria references
  for (const attr of ["aria-labelledby", "aria-describedby", "aria-controls"]) {
    for (const e of doc.querySelectorAll("[" + attr + "]")) {
      for (const id of e.getAttribute(attr).split(/\s+/).filter(Boolean)) {
        if (!doc.getElementById(id)) bad.push(attr + " target missing: #" + id + " on <" + e.tagName.toLowerCase() + (e.id ? " id=" + e.id : "") + ">");
      }
    }
  }
  // form fields
  for (const e of doc.querySelectorAll("input, select, textarea")) {
    const ty = (e.getAttribute("type") || "").toLowerCase();
    if (["hidden", "submit", "button", "reset", "image"].includes(ty)) continue;
    if (e.closest("#printRoot")) continue;
    if (!hasLabel(doc, e)) bad.push("field with no label: <" + e.tagName.toLowerCase() + (e.id ? " id=" + e.id : "") + ">");
  }
  // buttons and links
  for (const e of doc.querySelectorAll("button, a[href]")) {
    if (e.closest("#printRoot")) continue;
    if (!nameOf(doc, e)) bad.push("no accessible name: <" + e.tagName.toLowerCase() + (e.id ? " id=" + e.id : "") + " class=" + (e.className || "") + ">");
  }
  // navs
  const labels = [];
  for (const n of doc.querySelectorAll("nav")) {
    const l = (n.getAttribute("aria-label") || "").trim() || refText(doc, n.getAttribute("aria-labelledby") || "");
    if (!l) bad.push("nav with no label");
    else labels.push(l);
  }
  if (new Set(labels).size !== labels.length) bad.push("nav labels repeat: " + labels.join(" | "));
  assert.deepEqual(bad, [], at + bad.join("; "));
}

const interactions = {
  "resume.html": async ({ window, document }) => {
    // the third entry starts empty: fill it so the preview draws a new job
    type(window, document.getElementById("xt2"), "Dog walker");
    type(window, document.getElementById("xo2"), "Neighbors");
    type(window, document.getElementById("xd2"), "2026");
    type(window, document.getElementById("xb2"), "Walked two dogs after school");
    await tick(150);
  },
  "playbook.html": async ({ document }) => {
    const b = document.getElementById("addPerson");
    assert.ok(b && !b.hidden, "add person button shows");
    b.click();
    await tick(150);
  },
  "permit.html": async ({ window, document }) => {
    const sel = document.getElementById("pState");
    const st = [...sel.options].map((o) => o.value).find((v) => v);
    assert.ok(st, "a state option exists");
    type(window, sel, st);
    await tick(200);
  },
  "paycheck.html": async ({ window, document }) => {
    type(window, document.getElementById("mWage"), "15");
    type(window, document.getElementById("mHours"), "10");
    await tick(200);
  },
  "find.html": async ({ document }) => {
    const more = document.getElementById("more");
    assert.ok(more, "Show more button exists");
    more.click();
    await tick(200);
  },
};

test("there are root pages to check", () => assert.ok(pages.length >= 15, "found " + pages.length));

for (const f of pages) {
  test(f + ": names, ids and aria references hold after load" + (interactions[f] ? " and after one interaction" : ""), async () => {
    const page = await loadPage(f);
    await tick(150);
    audit(f, page.document, "after load");
    if (interactions[f]) {
      await interactions[f](page);
      audit(f, page.document, "after interaction");
    }
  });
}
