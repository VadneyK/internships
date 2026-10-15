// Ticket r3-teen-flow-5: footer Quick links are split into three labelled groups, teen steps first.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GROUPS = [
  ["Find and apply", ["find", "map", "playbook", "resume", "interview", "jobs", "calendar", "permit"]],
  ["Before day one", ["ready", "paycheck", "safety", "younger"]],
  ["About and help", ["parents", "handout", "languages", "insights", "rules", "states", "share", "contribute"]],
];
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

test("every built page groups the 20 quick links into three labelled lists", () => {
  for (const f of PAGES) {
    const doc = new JSDOM(fs.readFileSync(path.join(ROOT, f), "utf8")).window.document;
    const nav = doc.querySelector('footer.foot nav[aria-label="Quick links"]');
    assert.ok(nav, f);
    const lists = [...nav.querySelectorAll("ul.qlinks")];
    assert.equal(lists.length, 3, f);
    lists.forEach((ul, i) => {
      const label = doc.getElementById(ul.getAttribute("aria-labelledby"));
      assert.equal(label && label.textContent.trim(), GROUPS[i][0], f);
      const names = [...ul.querySelectorAll("li > a")].map((a) => a.getAttribute("href").replace(/^.*\//, "").replace(/\.html$/, ""));
      assert.deepEqual(names, GROUPS[i][1], f);
    });
  }
});
