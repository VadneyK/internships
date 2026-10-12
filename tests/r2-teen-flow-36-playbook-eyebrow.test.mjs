import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadPage } from "./dom-helper.mjs";

// The Playbook eyebrow must work for a teen who never saw the Home page's
// "Move 1, Move 2, Move 3" list, so it uses plain words with no move numbers.

test("playbook eyebrow: one non-empty tag with plain words, no 'Move', no digit", async () => {
  const { document, errors } = await loadPage("playbook.html");
  assert.deepEqual(errors, []);
  const tags = document.querySelectorAll("span.tag.eyebrow");
  assert.equal(tags.length, 1, "exactly one span.tag.eyebrow on the Playbook page");
  const text = tags[0].textContent.trim();
  assert.equal(typeof text, "string");
  assert.ok(text.length > 0, "eyebrow text is not empty");
  assert.doesNotMatch(text, /Move/i, "eyebrow does not name a move");
  assert.doesNotMatch(text, /\d/, "eyebrow has no digit");
  assert.doesNotMatch(text, /Moves 2 and 3/, "old eyebrow text is gone");
});

test("playbook eyebrow: source template uses the same plain words", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, "..", "src", "playbook.html"), "utf8");
  const m = src.match(/<span class="tag y eyebrow">([^<]*)<\/span>/);
  assert.ok(m, "src/playbook.html has the eyebrow span");
  assert.equal(m[1].trim(), "Reach out and follow up");
});
