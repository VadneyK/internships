// Ticket p6-handout-1: "Teach it in 45 minutes" on the teacher handout.
// The agenda minutes add up to 45, match the 45-minute table in docs/CLASSROOM.md, and every link in the section goes to a real page file.
// Run with: node --test tests/p6-handout-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const doc = new JSDOM(read("handout.html")).window.document;
const section = doc.getElementById("teach");

// Agenda rows from a table body: [startMinute, endMinute, rowText].
function agendaFromRows(rows) {
  return rows.map((row) => {
    const m = /^\s*(\d+) to (\d+)\s*$/.exec(row.first);
    assert.ok(m, `agenda cell reads "X to Y": ${JSON.stringify(row.first)}`);
    return [Number(m[1]), Number(m[2]), row.text];
  });
}

const handoutRows = [...section.querySelectorAll("table tbody tr")].map((tr) => ({
  first: tr.querySelector("td").textContent,
  text: tr.querySelectorAll("td")[1].textContent,
}));

// The 45-minute table in docs/CLASSROOM.md: the rows after its "## 45-minute version" heading.
function classroom45Rows() {
  const md = read("docs/CLASSROOM.md");
  const start = md.indexOf("## 45-minute version");
  assert.ok(start >= 0, "docs/CLASSROOM.md has a 45-minute version section");
  const rows = [];
  for (const line of md.slice(start).split("\n")) {
    const m = /^\|\s*(\d+ to \d+)\s*\|/.exec(line);
    if (m) rows.push({ first: m[1], text: line });
  }
  return rows;
}

test("the section exists once, with the right heading and sits outside the one-page sheet", () => {
  assert.ok(section, "section#teach exists");
  assert.equal(doc.querySelectorAll("#teach").length, 1);
  assert.equal(section.querySelector("h2").textContent.trim(), "Teach it in 45 minutes");
  assert.equal(doc.querySelectorAll("h1").length, 1, "still one h1");
  assert.ok(!doc.getElementById("handoutSheet").contains(section), "section is not inside the one-page sheet");
  assert.ok(!section.classList.contains("noprint"), "section prints");
  assert.match(section.getAttribute("style"), /break-before:\s*page/, "section starts on its own printed page");
});

test("agenda minutes run from 0 with no gaps and add up to 45", () => {
  const rows = agendaFromRows(handoutRows);
  assert.ok(rows.length >= 3, "agenda has rows");
  assert.equal(rows[0][0], 0, "agenda starts at minute 0");
  let total = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const [start, end] = rows[i];
    assert.ok(end > start, `row ${i} has a positive length`);
    if (i > 0) assert.equal(start, rows[i - 1][1], `row ${i} starts where row ${i - 1} ends`);
    total += end - start;
  }
  assert.equal(rows[rows.length - 1][1], 45, "agenda ends at minute 45");
  assert.equal(total, 45, "minutes add up to 45");
});

test("the agenda matches the 45-minute table in docs/CLASSROOM.md", () => {
  const mine = agendaFromRows(handoutRows).map(([s, e]) => `${s} to ${e}`);
  const plan = agendaFromRows(classroom45Rows()).map(([s, e]) => `${s} to ${e}`);
  assert.deepEqual(mine, plan);
});

test("the pair activity uses the Programs and Jobs pages, and there is a discussion, an exit question and an under 14 line", () => {
  const pair = agendaFromRows(handoutRows).find(([s]) => s === 10);
  assert.ok(pair, "a pair activity row starts at minute 10");
  const pairRow = handoutRows.find((r) => r.first === "10 to 35");
  assert.ok(pairRow.text.includes("Programs page"), "pair row names the Programs page");
  assert.ok(pairRow.text.includes("Jobs page"), "pair row names the Jobs page");
  const discuss = handoutRows.find((r) => r.first === "35 to 42");
  assert.ok(discuss && (discuss.text.match(/\?/g) || []).length >= 2, "discussion has questions");
  const exit = handoutRows.find((r) => r.first === "42 to 45");
  assert.ok(exit && /Exit question/.test(exit.text), "last minutes hold the exit question");
  const under14 = [...section.querySelectorAll("p")].find((p) => p.textContent.startsWith("Under 14"));
  assert.ok(under14 && under14.querySelector('a[href="younger.html"]'), "under 14 line links the Ages 12 to 14 page");
});

test("every link in the section is relative and resolves to a real page file (and any #fragment to a real id)", () => {
  const links = [...section.querySelectorAll("a[href]")];
  assert.ok(links.length >= 4, "section has links");
  const targets = new Set(links.map((a) => a.getAttribute("href")));
  for (const href of targets) {
    assert.doesNotMatch(href, /^[a-z]+:|^\/\//i, `link is internal: ${href}`);
    const [file, hash] = href.split("#");
    assert.match(file, /^[a-z0-9-]+\.html$/, `link points to a root page file: ${href}`);
    const abs = path.join(ROOT, file);
    assert.ok(fs.existsSync(abs), `link target exists: ${href}`);
    if (hash) {
      const target = new JSDOM(fs.readFileSync(abs, "utf8")).window.document;
      assert.ok(target.getElementById(hash), `fragment exists in ${file}: #${hash}`);
    }
  }
  for (const need of ["find.html", "jobs.html", "younger.html", "about.html#method"]) {
    assert.ok(targets.has(need), `section links to ${need}`);
  }
});

test("no em or en dash in the section, the source page or the classroom plan", () => {
  const dash = /[\u2013\u2014]/;
  assert.ok(!dash.test(section.textContent), "built section");
  assert.ok(!dash.test(read("src/handout.html")), "source page");
  assert.ok(!dash.test(read("docs/CLASSROOM.md")), "classroom plan");
});
