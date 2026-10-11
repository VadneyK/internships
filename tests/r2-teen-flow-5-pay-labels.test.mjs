// Ticket r2-teen-flow-5: the pay tags "Stipend" and "Mixed" say what they mean to a teen.
// Run with: node --test tests/r2-teen-flow-5-pay-labels.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const L = createRequire(import.meta.url)(path.join(ROOT, "assets/js/lib.js"));
const entries = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));
const DASH = /[‐-―−-]/;

test("r2-teen-flow-5: every paid_type in the data has a non-empty PAID label", () => {
  const types = new Set(entries.map((e) => e.paid_type));
  assert.ok(types.size > 0, "data has paid_type values");
  for (const t of types) {
    assert.equal(typeof L.PAID[t], "string", t + " has no label");
    assert.ok(L.PAID[t].trim().length > 0, t + " label is empty");
  }
});

test("r2-teen-flow-5: Stipend and Mixed labels say what they mean", () => {
  assert.equal(L.PAID.stipend, "Stipend (a flat payment)");
  assert.equal(L.PAID.mixed, "Pay or cost varies");
});

test("r2-teen-flow-5: no PAID label contains a dash character", () => {
  for (const [k, v] of Object.entries(L.PAID)) assert.equal(DASH.test(v), false, k + " label has a dash: " + v);
});

test("r2-teen-flow-5: a rendered Programs card for a mixed entry shows the new tag text", async () => {
  const mixed = entries.find((e) => e.paid_type === "mixed");
  assert.ok(mixed, "data has a mixed entry");
  const p = await loadPage("find.html");
  for (let i = 0; i < 80 && /Loading/.test(p.document.getElementById("count").textContent); i++) await tick(25);
  // search by one distinctive word of the name, so the card is on the first page of results
  const word = mixed.name.split(/\s+/).sort((a, b) => b.length - a.length)[0].replace(/[^A-Za-z]/g, "");
  type(p.window, p.document.getElementById("q"), word);
  await tick(260);
  const card = p.document.getElementById("p-" + mixed.id);
  assert.ok(card, "card for " + mixed.id + " should render");
  const tags = [...card.querySelector(".row").querySelectorAll(".tag")].map((t) => t.textContent.trim());
  assert.ok(tags.includes("Pay or cost varies"), "tags were " + JSON.stringify(tags));
  assert.deepEqual(p.errors, []);
});
