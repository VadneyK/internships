// Persona round 11 (2026-10-16, Marisol 15 in Phoenix and Gloria for her grandson, 14, in Atlanta):
// the grade flag on program cards, the rules.html scope and its route to the permit finder, the parents.html signature lead,
// the phone number in younger.html unknown cells, and the free/volunteer line near the top of the landing pages.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { loadPage, tick, waitFor } from "./dom-helper.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const L = createRequire(import.meta.url)("../assets/js/lib.js");
const json = (f) => JSON.parse(readFileSync(join(root, f), "utf8"));

test("r11: gradeSpan reads grades as this school year's grades", () => {
  const cases = [
    ["11-12", [11, 12]], ["9 to 12", [9, 12]], ["Grades 11 and 12", [11, 12]], ["11", [11, 11]],
    ["Rising 10th and 11th grade (current 9th and 10th graders)", [9, 10]],
    ["Current sophomores and juniors (the page also says rising juniors and seniors)", [10, 11]],
    ["Current 9th, 10th and 11th graders (rising sophomores, juniors, seniors)", [9, 11]],
    ["High school juniors and seniors", [11, 12]], ["High school", [9, 12]], ["Middle school", [6, 8]],
    ["Middle school or high school", [6, 12]], ["Junior high", [7, 8]], ["9 and up", [9, 12]],
    ["Entering grades 11 or 12 in fall 2027", [10, 11]], ["11th grade at time of application (rising seniors)", [11, 11]],
    ["Entering or current high school student", [9, 12]], ["Finished 8th grade", [8, 12]],
    ["Kindergarten through one year past high school (grade 13)", [1, 12]],
  ];
  for (const [t, want] of cases) assert.deepEqual(L.gradeSpan(t), { lo: want[0], hi: want[1] }, t);
  for (const t of ["", null, "Teen", "Not seniors", "Ages 13 to 15", "GPA 3.0 and grades 10 to 12", "High school and college students",
    "Rising 9th grade (CIT); high school (counselor)", "Grades K through 13", "Not stated on the program pages", "any high school student"]) {
    assert.equal(L.gradeSpan(t), null, String(t));
  }
});

test("r11: gradeFit flags a likely mismatch only with an age picked and no ages on the card", () => {
  const e = (grades, extra) => Object.assign({ grades: grades, min_age: null, max_age: null }, extra);
  assert.equal(L.gradeFit(e("11-12"), "15"), "young");
  assert.equal(L.gradeFit(e("11-12"), "16"), "");
  assert.equal(L.gradeFit(e("9-12"), "15"), "");
  assert.equal(L.gradeFit(e("9-12"), "13"), "young");
  assert.equal(L.gradeFit(e("6 to 8"), "15"), "old");
  assert.equal(L.gradeFit(e("6 to 9"), "15"), "");
  assert.equal(L.gradeFit(e("11-12"), ""), "", "no age picked");
  assert.equal(L.gradeFit(e("11-12"), "11"), "", "outside the picker's 12 to 18");
  assert.equal(L.gradeFit(e("11-12", { min_age: 14 }), "15"), "", "the card's own ages win");
  assert.equal(L.gradeFit(e(null), "15"), "");
  // The persona cards, from the real data.
  const lite = json("data/entries-lite.json"), by = (id) => lite.find((x) => x.id === id);
  assert.equal(L.gradeFit(by("asu-jbmshp-math-science-honors-summer"), "15"), "young");
  assert.equal(L.gradeFit(by("asu-wp-carey-fleischer-scholars"), "15"), "young");
  assert.equal(L.gradeFit(by("asu-access-inspire-summer-program"), "15"), "");
  assert.equal(L.gradeFit(by("georgia-dnr-career-academy"), "14"), "young");
  assert.equal(L.gradeFit(by("uga-caes-agriquest-youth-summer-camp"), "14"), "");
  assert.equal(L.gradeFit(by("spelman-college-prep-institute"), "14"), "", "current 9th and 10th graders fit 14");
});

test("r11: find.html shows the grade flag next to the grades for the picked age", async () => {
  const { window, document } = await loadPage("find.html", { search: "?where=atl&age=14" });
  await waitFor(() => document.getElementById("p-georgia-dnr-career-academy") || document.getElementById("showBtn"));
  if (!document.getElementById("p-georgia-dnr-career-academy")) { document.getElementById("showBtn").click(); await tick(); }
  await waitFor(() => document.getElementById("p-georgia-dnr-career-academy"));
  const dnr = document.getElementById("p-georgia-dnr-career-academy").querySelector("[data-gradefit]");
  assert.ok(dnr, "DNR card is flagged at 14");
  assert.equal(dnr.textContent, "May be too young at 14: check the grades");
  assert.equal(dnr.getAttribute("data-gradefit"), "young");
  const spelman = document.getElementById("p-spelman-college-prep-institute");
  assert.ok(spelman, "Spelman card shown");
  assert.equal(spelman.querySelector("[data-gradefit]"), null);
  assert.ok(document.getElementById("costNote").textContent.includes("A job should never ask you to pay to apply."));
  window.close();
});

test("r11: Good fit picks skip cards whose grades likely leave the age out, as they skip limited cards", async () => {
  const { window, document } = await loadPage("find.html", { search: "?at=city%3Aphoenix&age=15" });
  await waitFor(() => document.querySelectorAll("#picksList li").length > 0 && document.querySelectorAll("[data-gradefit]").length > 0);
  const flagged = new Set([...document.querySelectorAll("[data-gradefit]")].map((x) => x.closest("article").id.slice(2)));
  const picks = [...document.querySelectorAll("#picksList [data-jump]")].map((a) => a.getAttribute("data-jump"));
  assert.ok(picks.length > 0);
  for (const id of picks) assert.ok(!flagged.has(id), id + " is flagged but was picked");
  window.close();
});

test("r11: rules.html says California up front and routes every other state to the permit finder", () => {
  const html = readFileSync(join(root, "rules.html"), "utf8");
  assert.match(html, /<h1 class="display">The <span class="orange">rules<\/span> in California<\/h1>/);
  const at = html.indexOf('id="notCa"');
  assert.ok(at > 0 && at < html.indexOf("This is a summary, not legal advice"), "the callout comes before the summary box");
  const box = html.slice(at, html.indexOf("</div>", at));
  assert.match(box, /Not in California\?/);
  for (const a of ["permit.html", "states.html#georgia", "states.html#newyork", "states.html#illinois"]) assert.ok(box.includes('href="' + a + '"'), a);
});

test("r11: parents.html no longer says a parent usually signs; Georgia says no signature is listed", () => {
  const p = json("data/parents.json");
  assert.doesNotMatch(p.sign.lead.t, /usually/);
  assert.match(p.sign.lead.t, /^It depends on the state\./);
  assert.match(p.sign.states.find((s) => s.id === "ga").parent, /^No parent signature is listed/);
  assert.doesNotMatch(readFileSync(join(root, "languages.html"), "utf8"), /A parent usually has to sign/);
});

test("r11: younger.html unknown cells carry the state's number, tap-to-call", async () => {
  const { window, document } = await loadPage("younger.html");
  await waitFor(() => document.querySelectorAll("#gridT td .tag.ghost").length > 0);
  const cells = [...document.querySelectorAll("#gridT td")].filter((td) => td.querySelector(".tag.ghost"));
  assert.ok(cells.length >= 7, "got " + cells.length);
  const ga = cells.filter((td) => td.querySelector(".tk").textContent === "Georgia");
  assert.ok(ga.length >= 3, "Georgia unknown cells");
  for (const td of ga) assert.ok(td.querySelector('a[href="tel:+18777098185"]'), td.textContent);
  for (const td of cells) assert.equal(td.querySelectorAll('a[href^="tel:"]').length >= 1, true, td.textContent);
  window.close();
});

test("r11: the landing pages say free, volunteer-made and not church-run near the top, with a way to reach us", () => {
  for (const f of ["index.html", "find.html", "parents.html", "permit.html", "younger.html"]) {
    const html = readFileSync(join(root, f), "utf8");
    const at = html.indexOf("data-trust");
    assert.ok(at > 0 && at < html.indexOf("<footer"), f);
    assert.ok(at - html.indexOf("<main") < 4000, f + ": in the first part of the page");
    const line = html.slice(at, html.indexOf("</p>", at));
    for (const w of ["Free.", "No sign-up", "Made by a volunteer", "a church", "github.com/VadneyK/internships/issues"]) assert.ok(line.includes(w), f + ": " + w);
    // find.html keeps the skip link as the first thing to tab to in main, so its contact is plain text there.
    assert.equal(line.includes("<a "), f !== "find.html", f + ": link");
  }
});
