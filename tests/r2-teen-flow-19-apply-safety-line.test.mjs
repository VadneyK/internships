// Ticket r2-teen-flow-3: Interview (#ask) and Playbook (#send) carry the same three safety sentences
// as Jobs (jobs.js helpLines), with links to safety.html and rules.html#scams.
// Run with: node --test tests/r2-teen-flow-19-apply-safety-line.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SAFETY_TEXT = "Never pay to get a job. Never send your ID to a stranger. Tell an adult before an interview.";
const DASHES = /[\u2013\u2014]/;

const cases = [
  ["interview.html", "ask"],
  ["playbook.html", "send"],
];

for (const [file, sectionId] of cases) {
  test(file + ": #" + sectionId + " has the safety paragraph inside main with both links", async () => {
    const { document, errors } = await loadPage(file);
    assert.deepEqual(errors, []);
    const section = document.getElementById(sectionId);
    assert.ok(section, "#" + sectionId + " exists");
    const main = document.querySelector("main");
    assert.ok(main && main.contains(section), "#" + sectionId + " is inside main");
    const para = [...section.querySelectorAll("p")].find((p) => p.textContent.includes(SAFETY_TEXT));
    assert.ok(para, file + " has the three safety sentences in #" + sectionId);
    assert.ok(main.contains(para), "paragraph is inside main");
    const hrefs = [...para.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    assert.ok(hrefs.includes("safety.html"), "links to safety.html");
    assert.ok(hrefs.includes("rules.html#scams"), "links to rules.html#scams");
    assert.equal(DASHES.test(para.textContent), false, "no en or em dash");
  });
}

test("rules.html contains id=scams so the link lands on the scam checklist", () => {
  const html = fs.readFileSync(path.join(here, "..", "rules.html"), "utf8");
  assert.match(html, /id="scams"/);
});

test("the safety sentences match the Jobs page helpLines text", () => {
  const js = fs.readFileSync(path.join(here, "..", "assets", "js", "jobs.js"), "utf8");
  assert.ok(js.includes(SAFETY_TEXT), "jobs.js helpLines has the same three sentences");
});
