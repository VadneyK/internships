import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("permit: the share line does not say a parent signs the permit (built file)", () => {
  const html = fs.readFileSync(path.join(ROOT, "permit.html"), "utf8");
  const m = html.match(/<p class="share-parent[^"]*"[^>]*>([\s\S]*?)<\/p>/);
  assert.ok(m, "share-parent row is in permit.html");
  assert.doesNotMatch(m[1], /signs/i, "share-parent text must not say a parent signs");
  assert.match(m[1], /Show a parent this answer:/);
  assert.match(html, /data-share="Here is the work permit answer for me:"/);
});

test("permit: the share-parent row still gets the text link and copy button after load", async () => {
  const { document, errors } = await loadPage("permit.html"); await tick(200);
  assert.deepEqual(errors, []);
  const row = document.querySelector("p.share-parent[data-share]");
  assert.ok(row, "share row is on the page");
  assert.doesNotMatch(row.textContent, /signs/i);
  const link = [...row.querySelectorAll("a")].find((a) => a.textContent === "Text this to a parent");
  assert.ok(link, "Text this to a parent link is wired");
  const copy = [...row.querySelectorAll("button")].find((b) => b.textContent === "Copy link");
  assert.ok(copy, "Copy link button is wired");
  assert.equal(copy.type, "button");
});
