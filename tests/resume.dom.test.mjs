import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

const PAGE_TITLE = "Your First Resume: One Page, No Experience Needed";

function preview(document) {
  return document.getElementById("rv");
}

// The h3 headings in the preview are followed by their section content.
function sectionAfter(p, label) {
  const h = [...p.querySelectorAll("h3")].find((x) => x.textContent === label);
  return h ? h.nextElementSibling : null;
}

// Experience rows are .rrow elements whose first span starts with the title/place text,
// followed by a UL of bullets. Anchor on the row so the count is not polluted by other lists.
function experienceRow(p, startsWith) {
  return [...p.querySelectorAll(".rrow")].find((r) => r.firstElementChild && r.firstElementChild.textContent.startsWith(startsWith)) || null;
}
function bulletsFor(p, startsWith) {
  const row = experienceRow(p, startsWith);
  const ul = row && row.nextElementSibling;
  return ul && ul.tagName === "UL" ? [...ul.querySelectorAll("li")].map((li) => li.textContent) : null;
}

const TEXT_FIELDS = ["rName", "rEmail", "rPhone", "rCity", "rSchool", "rGrad", "rEduNote", "rAct", "rSkills", "rAwards", "xt0", "xo0", "xd0", "xb0"];

test("resume: loads with no script errors and the preview shows the example name", async () => {
  const { document, errors } = await loadPage("resume.html");
  assert.deepEqual(errors, []);
  assert.equal(preview(document).querySelector("h2").textContent, "Alex Rivera");
  assert.equal(document.title, PAGE_TITLE);
});

test("resume: typing in each field updates the preview", async () => {
  const { window, document, errors } = await loadPage("resume.html");
  const p = preview(document);
  const contact = () => p.querySelector(".contact").textContent;

  type(window, document.getElementById("rName"), "Jordan Lee");
  assert.equal(p.querySelector("h2").textContent, "Jordan Lee");

  type(window, document.getElementById("rEmail"), "jordan@example.org");
  assert.ok(contact().includes("jordan@example.org"));

  type(window, document.getElementById("rPhone"), "(510) 555-0199");
  assert.ok(contact().includes("(510) 555-0199"));

  type(window, document.getElementById("rCity"), "Berkeley, CA");
  assert.ok(contact().includes("Berkeley, CA"));

  type(window, document.getElementById("rSchool"), "Berkeley High School");
  assert.equal(sectionAfter(p, "EDUCATION").textContent.includes("Berkeley High School"), true);

  type(window, document.getElementById("rGrad"), "Class of 2027");
  assert.ok(sectionAfter(p, "EDUCATION").textContent.includes("Class of 2027"));

  type(window, document.getElementById("rEduNote"), "GPA 3.9");
  assert.ok(p.textContent.includes("GPA 3.9"));

  type(window, document.getElementById("rAct"), "Chess Club, captain\n\nDebate team");
  assert.deepEqual([...sectionAfter(p, "ACTIVITIES").querySelectorAll("li")].map((li) => li.textContent), ["Chess Club, captain", "Debate team"]);

  type(window, document.getElementById("rSkills"), "Python, French,  , Excel");
  assert.equal(sectionAfter(p, "SKILLS").textContent, "Python, French, Excel");

  type(window, document.getElementById("rAwards"), "Honor Roll, 2026");
  assert.equal(sectionAfter(p, "AWARDS").textContent, "Honor Roll, 2026");

  assert.deepEqual(errors, []);
});

test("resume: HTML typed into fields is escaped and no img element appears in the preview", async () => {
  const { window, document, errors } = await loadPage("resume.html");
  const payload = "<img src=x onerror=alert(1)>";
  for (const id of TEXT_FIELDS) type(window, document.getElementById(id), payload);
  const p = preview(document);
  assert.equal(p.querySelectorAll("img").length, 0);
  assert.equal(p.querySelector("h2").textContent, payload);
  assert.ok(p.textContent.includes(payload));
  assert.deepEqual(errors, []);
});

test("resume: editing the example experience entry and its bullets updates the preview", async () => {
  const { window, document, errors } = await loadPage("resume.html");
  const p = preview(document);
  assert.deepEqual(bulletsFor(p, "Volunteer, Oakland Public Library"), [
    "Shelved and sorted about 200 books per shift",
    "Helped younger kids pick books at the summer reading table"
  ]);

  type(window, document.getElementById("xb0"), "Ran the check-out desk\n\n   Stocked shelves   \n");
  assert.deepEqual(bulletsFor(p, "Volunteer, Oakland Public Library"), ["Ran the check-out desk", "Stocked shelves"]);

  type(window, document.getElementById("xd0"), "Fall 2026");
  assert.ok(experienceRow(p, "Volunteer, Oakland Public Library").textContent.includes("Fall 2026"));

  assert.deepEqual(errors, []);
});

test("resume: the third experience slot can be filled and shows as a new entry", async () => {
  const { window, document, errors } = await loadPage("resume.html");
  const p = preview(document);
  type(window, document.getElementById("xt2"), "Lifeguard");
  type(window, document.getElementById("xo2"), "Lakeside Pool");
  type(window, document.getElementById("xd2"), "Summer 2025");
  type(window, document.getElementById("xb2"), "Watched swimmers\n\nTaught two lessons a day");

  assert.ok(experienceRow(p, "Lifeguard, Lakeside Pool"));
  assert.ok(experienceRow(p, "Lifeguard, Lakeside Pool").textContent.includes("Summer 2025"));
  assert.deepEqual(bulletsFor(p, "Lifeguard, Lakeside Pool"), ["Watched swimmers", "Taught two lessons a day"]);
  assert.ok(bulletsFor(p, "Volunteer, Oakland Public Library"));
  assert.ok(bulletsFor(p, "Babysitter, Neighborhood families"));

  assert.deepEqual(errors, []);
});

test("resume: emptying an experience entry removes it from the preview", async () => {
  const { window, document, errors } = await loadPage("resume.html");
  const p = preview(document);
  for (const id of ["xt0", "xo0", "xd0", "xb0"]) type(window, document.getElementById(id), "");
  assert.equal(experienceRow(p, "Volunteer"), null);
  assert.ok(bulletsFor(p, "Babysitter, Neighborhood families"));
  assert.deepEqual(errors, []);
});

test("resume: Clear the example empties every field and the preview has no undefined or null", async () => {
  const { document, errors } = await loadPage("resume.html");
  document.getElementById("rClear").click();

  const fields = [...document.querySelectorAll("#rf input, #rf textarea")];
  assert.ok(fields.length > 0);
  assert.ok(fields.every((el) => el.value === ""), "every field in the form is empty");

  const p = preview(document);
  assert.equal(p.querySelector("h2").textContent, "Your name");
  assert.doesNotMatch(p.textContent, /undefined|null|\[object/);
  assert.equal(sectionAfter(p, "EDUCATION"), null);
  assert.equal(sectionAfter(p, "EXPERIENCE"), null);
  assert.equal(document.activeElement.id, "rName");
  assert.deepEqual(errors, []);
});

test("resume: Copy as text puts well-formed text on the clipboard", async () => {
  const { window, document, errors } = await loadPage("resume.html");
  let copied = null;
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: (t) => { copied = t; return Promise.resolve(); } },
    configurable: true
  });

  document.getElementById("rCopy").click();
  await tick();

  assert.equal(typeof copied, "string");
  const lines = copied.split("\n");
  assert.equal(lines[0], "ALEX RIVERA");
  assert.equal(lines[1], "Oakland, CA | alex.rivera@example.com | (510) 555-0142");
  assert.ok(lines.includes("EDUCATION"));
  assert.ok(lines.includes("Oakland Technical High School, Expected June 2028"));
  assert.ok(lines.includes("EXPERIENCE"));
  assert.ok(lines.includes("Volunteer, Oakland Public Library (Summer 2026)"));
  assert.ok(lines.includes("- Shelved and sorted about 200 books per shift"));
  assert.ok(lines.includes("ACTIVITIES"));
  assert.ok(lines.includes("- Robotics Club, build team member, 2025 to present"));
  assert.ok(lines.includes("SKILLS"));
  assert.ok(lines.includes("AWARDS"));
  assert.ok(lines.includes("Honor Roll, 2025"));
  assert.doesNotMatch(copied, /undefined|null|\[object/);
  assert.ok(!lines.some((l) => /^-\s*$/.test(l)), "no empty bullet lines");
  assert.equal(document.getElementById("toast").textContent, "Copied");
  assert.deepEqual(errors, []);
});

test("resume: Print sets print-one and a printRoot before window.print, then cleans up on afterprint", async () => {
  const { window, document, errors } = await loadPage("resume.html");
  const originalTitle = document.title;
  const calls = [];
  window.print = () => {
    const root = document.getElementById("printRoot");
    calls.push({
      bodyHasPrintOne: document.body.classList.contains("print-one"),
      rootIsDirectChildOfBody: !!root && root.parentNode === document.body,
      rootHasResume: !!(root && root.querySelector(".resume")),
      rootText: root ? root.textContent : "",
      title: document.title
    });
  };

  document.getElementById("rPrint").click();

  assert.equal(calls.length, 1, "window.print called exactly once");
  const c = calls[0];
  assert.equal(c.bodyHasPrintOne, true);
  assert.equal(c.rootIsDirectChildOfBody, true);
  assert.equal(c.rootHasResume, true);
  assert.ok(c.rootText.includes("Alex Rivera"));
  assert.equal(c.title, "AlexRivera_Resume");

  window.dispatchEvent(new window.Event("afterprint"));

  assert.equal(document.body.classList.contains("print-one"), false);
  assert.equal(document.getElementById("printRoot"), null);
  assert.equal(document.title, originalTitle);
  assert.equal(document.title, PAGE_TITLE);
  assert.deepEqual(errors, []);
});

test("resume: a very long name and 40 bullets do not throw and render in full", async () => {
  const { window, document, errors } = await loadPage("resume.html");
  const p = preview(document);

  const longName = "Maximiliana ".repeat(40).trim();
  type(window, document.getElementById("rName"), longName);
  assert.equal(p.querySelector("h2").textContent, longName);

  const bullets = Array.from({ length: 40 }, (_, i) => "Bullet " + (i + 1) + " did a thing");
  type(window, document.getElementById("xb0"), bullets.join("\n"));
  const list = bulletsFor(p, "Volunteer, Oakland Public Library");
  assert.equal(list.length, 40);
  assert.equal(list[0], "Bullet 1 did a thing");
  assert.equal(list[39], "Bullet 40 did a thing");

  window.print = () => {};
  document.getElementById("rPrint").click();
  window.dispatchEvent(new window.Event("afterprint"));
  assert.equal(document.title, PAGE_TITLE);

  assert.deepEqual(errors, []);
});
