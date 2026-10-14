// Leader feedback (2026-10-14): teens never give the site anything. Leaders ask three questions out loud and send what the group said
// in an adult-only Google Form, linked (never embedded). Sources: veru-365/docs/research/internship-guide-feedback-safety-2026-10-14.md
// Run with: node --test tests/leader-feedback-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const doc = new JSDOM(read("handout.html")).window.document;

test("handout: the leader box asks three questions out loud and links the adult-only form", () => {
  const box = doc.getElementById("leaderFeedback");
  assert.ok(box, "the box is on the handout page");
  assert.ok(box.closest("#table"), "it sits in the 30 minute table plan, so it prints with it");
  assert.equal(box.querySelectorAll("ol li").length, 3);
  const text = box.textContent.replace(/\s+/g, " ");
  assert.match(text, /Do not write down students. names/);
  assert.match(text, /do not take photos, screenshots or recordings/);
  assert.match(text, /adults 18 and older/);
  const a = box.querySelector("a");
  assert.match(a.getAttribute("href"), /^https:\/\/(forms\.gle\/|docs\.google\.com\/forms\/)/);
  assert.equal(a.getAttribute("rel"), "noopener noreferrer");
});

test("no page embeds a form or frames another site", () => {
  for (const f of fs.readdirSync(ROOT).filter((n) => n.endsWith(".html"))) {
    const html = read(f);
    assert.ok(!/<iframe/i.test(html), f + " has an iframe");
    assert.ok(!/<form[^>]+action=["']https?:/i.test(html), f + " posts a form to another site");
  }
});

test("teens are sent to a parent or youth leader, not to an account-based site", () => {
  const index = read("index.html");
  assert.match(index, /Teens: tell a parent or youth leader\. Adults: <a href="https:\/\/github\.com\/VadneyK\/internships\/issues">tell us on GitHub<\/a>/);
  assert.match(read("find.html"), /Ask a parent or youth leader to <a href="https:\/\/github\.com\/VadneyK\/internships\/issues">tell us on GitHub<\/a>/);
});

// Legal review 2026-10-14 (veru-365/docs/research/internship-guide-legal-review-2026-10-14.md).
test("privacy, method and license notes from the legal review are on the site", () => {
  const about = read("about.html").replace(/\s+/g, " ");
  assert.match(about, /it can show in the page address \(for example find\.html\?age=14\)/);
  assert.match(about, /short Google Form linked from the handout page\. It is for adults 18 and older and asks for no names or emails/);
  assert.match(about, /Any change to this privacy section shows in the site/);
  assert.match(about, /We did not visit, screen or background-check any program, employer or adult/);
  assert.match(about, /Under 13\? Ask a parent or youth leader to send it/);
  assert.match(read("find.html"), /None of these tags means we visited, screened or recommend a program\./);
  assert.match(read("jobs.html"), /A listing is not a recommendation, and we did not screen any employer\./);
  assert.match(read("handout.html"), /follow your own church or program&rsquo;s child-protection and reporting rules/);
  assert.match(read("leaders.html"), /It does not ask for names or emails\./);
  assert.ok(fs.existsSync(path.join(ROOT, "licenses/fonts-OFL.txt")) && fs.existsSync(path.join(ROOT, "licenses/font-PermanentMarker-Apache-2.0.txt")));
  assert.match(read("LICENSE-DATA.md"), /are not licensed under CC BY 4\.0/);
});
