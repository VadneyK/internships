// Ticket r2-teen-flow-6: a plain "Not in California" line right under "3. Getting paid" on ready.html.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("r6-teen-flow-6: a plain Not in California paragraph sits right under the 3. Getting paid heading", async () => {
  const { document } = await loadPage("ready.html");
  const money = document.getElementById("money");
  assert.ok(money, "#money should exist");
  const h2 = money.querySelector("h2");
  assert.equal(h2.textContent.trim(), "3. Getting paid");
  const next = h2.nextElementSibling;
  assert.equal(next.tagName, "P", "the element right after the heading should be a paragraph");
  assert.match(next.textContent, /^Not in California\?/);
  assert.match(next.textContent, /California/);
  assert.equal(next.closest("details"), null, "the paragraph should not be inside a closed details");
  assert.equal(next.parentElement, money.querySelector(".wrap"), "the paragraph should sit in the #money wrap");
});

test("r6-teen-flow-6: the paragraph has at most 30 words and no dash characters", async () => {
  const { document } = await loadPage("ready.html");
  const p = document.getElementById("money").querySelector("h2").nextElementSibling;
  const words = p.textContent.trim().split(/\s+/);
  assert.ok(words.length <= 30, "word count should be at most 30, found " + words.length);
  assert.doesNotMatch(p.textContent, /[\u2013\u2014]/, "no en or em dash");
});

test("r6-teen-flow-6: the paragraph links to paycheck.html and permit.html, with link names unique inside #money", async () => {
  const { document } = await loadPage("ready.html");
  const money = document.getElementById("money");
  const p = money.querySelector("h2").nextElementSibling;
  const hrefs = [...p.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(hrefs.sort(), ["paycheck.html", "permit.html"]);
  const names = [...money.querySelectorAll("a")].map((a) => a.textContent.trim());
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dupes, [], "link names inside #money should be unique");
});

test("r6-teen-flow-6: the built ready.html contains the same paragraph as src/ready.html", () => {
  const src = readFileSync(join(ROOT, "src", "ready.html"), "utf8");
  const built = readFileSync(join(ROOT, "ready.html"), "utf8");
  const line = src.split("\n").find((l) => l.includes("Not in California? The cards below are for California only."));
  assert.ok(line, "src should hold the Not in California paragraph");
  assert.ok(built.includes(line.trim()), "built ready.html should contain the same paragraph");
});
