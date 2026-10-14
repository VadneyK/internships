// SoCal round 10 (2026-10-14, a Costa Mesa teen and a Santa Ana parent before the Costa Mesa table): fixes they found.
// Run with: node --test tests/socal-r10-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const DATA = JSON.parse(read("data/entries.json"));
const byId = Object.fromEntries(DATA.map((e) => [e.id, e]));

test("phones: the filter summary can shrink and a long place name wraps instead of pushing the page sideways", () => {
  const css = read("assets/css/style.css");
  assert.match(css, /\.fsum \{[^}]*min-width: 0;/);
  assert.match(css, /@media \(max-width: 40rem\) \{ \.fchip \{ white-space: normal; \}/);
});

test("Six Flags rules come from the New Jersey park page, so the row is for New Jersey only", () => {
  const emp = JSON.parse(read("data/employers.json"));
  const six = emp.employers.find((e) => e.id === "six-flags");
  assert.deepEqual(six.where, ["NJ"]);
  assert.match(six.url, /greatadventure/);
});

async function picks(search) {
  const { document } = await loadPage("find.html", { search });
  for (let i = 0; i < 60 && !document.querySelector("#picksList li"); i++) await tick(50);
  return { document, ids: [...document.querySelectorAll("#picksList [data-jump]")].map((a) => a.getAttribute("data-jump")) };
}

test("the SoCal QR with no age says the picks come from the area only", async () => {
  const { document } = await picks("?where=socal");
  assert.match(document.getElementById("picksWhy").textContent, /^Picked from your area\. Pick your age for a closer fit\./);
});

test("with Paid chosen, every pick is paid, a stipend or mixed pay", async () => {
  const { ids } = await picks("?at=city%3Airvine&age=16&pay=pay");
  assert.ok(ids.length >= 1);
  for (const id of ids) assert.ok(["paid", "stipend", "mixed"].includes(byId[id].paid_type), id + " is " + byId[id].paid_type);
});
