// Run with: node --test tests/r1-teen-flow-19-playbook-pick-two.test.mjs
// The After the yes card on the Playbook says "Pick two questions to ask" (not "Prepare two questions"),
// with a short line saying to choose two from the list below it. The reminder string in playbook.js
// says the same thing. Reads the built playbook.html and the script as text.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTML = fs.readFileSync(path.join(ROOT, "playbook.html"), "utf8");
const JS = fs.readFileSync(path.join(ROOT, "assets/js/playbook.js"), "utf8");

// The "after" section, from its opening tag to the next section tag.
function afterSection(html) {
  const start = html.indexOf('<section id="after"');
  assert.ok(start >= 0, "built playbook.html has a #after section");
  const end = html.indexOf("</section>", start);
  return html.slice(start, end);
}

test("Before card heading in #after reads 'Pick two questions to ask'", () => {
  const sec = afterSection(HTML);
  const m = sec.match(/<h3[^>]*>([^<]*)<\/h3>\s*<p class="small muted">([^<]*)<\/p>/);
  assert.ok(m, "the Before card has an h3 followed by a short muted line");
  assert.equal(m[1], "Pick two questions to ask");
  assert.equal(m[2], "Choose two from this list.");
});

test("the old 'Prepare two questions' heading is gone from the built page and the script", () => {
  assert.equal(HTML.includes("Prepare two questions"), false);
  assert.equal(JS.includes("Prepare two questions"), false);
});

test("the reminder string in playbook.js says 'Pick two questions to ask. See step 4 below.'", () => {
  assert.ok(JS.includes("<p>Pick two questions to ask. See step 4 below.</p>"));
});

test("the Before card still lists its five questions", () => {
  const sec = afterSection(HTML);
  const card = sec.slice(sec.indexOf('<span class="tag y">Before</span>'));
  const items = card.slice(0, card.indexOf("</ul>")).match(/<li>/g) || [];
  assert.equal(items.length, 5);
});
