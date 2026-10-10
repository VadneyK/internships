// Hand-written data tables: header scopes, row headers, and the CSS rule that keeps row labels looking like the old bold cell.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const doc = (f) => new JSDOM(fs.readFileSync(path.join(root, f), "utf8")).window.document;
const byLabel = (d, label) => d.querySelector('[aria-label="' + label + '"] table');

test("every th in a thead has scope=col on the five pages", () => {
  for (const f of ["rules.html", "ready.html", "interview.html", "leaders.html", "resume.html"]) {
    const ths = doc(f).querySelectorAll("thead th");
    assert.ok(ths.length > 0, f);
    for (const th of ths) assert.equal(th.getAttribute("scope"), "col", f + " " + th.textContent);
  }
});

const rowTables = [
  ["rules.html", "Hours by age", ["12 to 13", "14 to 15", "16 to 17"]],
  ["rules.html", "Minimum wage by city", ["Davis, Sacramento (state rate)", "Oakland", "Alameda", "Fremont", "San Jose", "Palo Alto", "Sunnyvale", "Mountain View", "Berkeley", "San Francisco", "Emeryville"]],
  ["rules.html", "Online age limits", ["LinkedIn", "Handshake", "Indeed"]],
  ["ready.html", "Youth transit options by area", ["San Francisco (Muni)", "Sacramento (SacRT)", "Yolo County (Yolobus)", "Davis (Unitrans)", "Alameda County (local buses)", "BART and AC Transit", "Santa Clara County (VTA)", "Caltrain"]],
];
for (const [f, label, names] of rowTables) {
  test(label + ": first cell of each row is th scope=row with the same text", () => {
    const rows = [...byLabel(doc(f), label).querySelectorAll("tbody tr")];
    assert.deepEqual(rows.map((r) => r.firstElementChild.textContent.trim()), names);
    for (const r of rows) {
      assert.equal(r.firstElementChild.tagName, "TH");
      assert.equal(r.firstElementChild.getAttribute("scope"), "row");
      assert.equal(r.querySelectorAll("th").length, 1);
    }
  });
}

test("other cells and links are unchanged", () => {
  const d = doc("ready.html");
  const links = [...byLabel(d, "Youth transit options by area").querySelectorAll("tbody a")].map((a) => a.getAttribute("href"));
  assert.equal(links.length, 9);
  assert.ok(links.includes("https://www.sfmta.com/getting-around/muni/fares/free-muni"));
  const r = doc("rules.html");
  assert.equal(byLabel(r, "Hours by age").querySelectorAll("tbody tr")[0].children.length, 5);
  assert.equal(byLabel(r, "Minimum wage by city").querySelectorAll("tbody tr")[1].children[1].textContent, "$17.34 (Jan 1)");
});

test("run-of-show and resume tables keep td cells", () => {
  for (const [f, label] of [["leaders.html", "Run of show for the evening"], ["resume.html", "Resume bullet examples"]]) {
    const t = byLabel(doc(f), label);
    assert.equal(t.querySelectorAll("tbody th").length, 0, f);
    assert.ok(t.querySelectorAll("tbody td").length > 0, f);
  }
});

test("style.css resets row-header look with tokens, not hex", () => {
  const css = fs.readFileSync(path.join(root, "assets/css/style.css"), "utf8");
  const m = css.match(/tbody th\[scope="row"\]\s*\{([^}]*)\}/);
  assert.ok(m, "rule exists");
  const body = m[1];
  assert.match(body, /background:/);
  assert.match(body, /color:\s*(var\(--ink\)|inherit)/);
  assert.match(body, /text-transform:/);
  assert.match(body, /letter-spacing:/);
  assert.doesNotMatch(body, /#[0-9a-fA-F]{3,8}\b/);
});
