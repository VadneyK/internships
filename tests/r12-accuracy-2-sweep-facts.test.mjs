// Quality sweep 2026-10-16 (issue #9 sweep, docs/research/quality-sweep-2026-10.md items F1, F2, F4, F5, F8, F9 and F10): facts and links that disagreed
// between pages, each fixed and locked here.
// Run with: node --test tests/r12-accuracy-2-sweep-facts.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick, waitFor } from "./dom-helper.mjs";

const ROOT = new URL("../", import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, ROOT), "utf8");
const json = (f) => JSON.parse(read(f));
const FED = "Employers covered by federal law pay the federal rate instead.";

test("F1: the hours planner has a separate choice for a break outside summer, and the page passes it to hoursCheck", async () => {
  const src = read("src/interview.html");
  assert.match(src, /<option value="1">School is in session<\/option><option value="0">Summer break<\/option><option value="2">Another school break<\/option>/);
  assert.match(read("assets/js/interview.js"), /ds, \$\("aSchool"\)\.value === "2"\)/);
  const p = await loadPage("interview.html", { search: "?state=ca&age=14" });
  const { window, document } = p;
  await waitFor(() => document.querySelector('[data-d="0"][data-k="from"] option[value="19"]'), { timeout: 30000 });
  const set = (id, v) => { const s = document.getElementById(id); s.value = v; s.dispatchEvent(new window.Event("change", { bubbles: true })); };
  set("aAge", "14"); set("aState", "ca");
  const from = document.querySelector('[data-d="0"][data-k="from"]'), to = document.querySelector('[data-d="0"][data-k="to"]');
  from.value = "19"; to.value = "21"; to.dispatchEvent(new window.Event("change", { bubbles: true }));
  set("aSchool", "0"); await tick(20);
  assert.match(document.getElementById("aOut").textContent, /Within the limits we found/, "summer: 7 to 9 p.m. fits at 14");
  set("aSchool", "2"); await tick(20);
  assert.match(document.getElementById("aOut").textContent, /past the usual limit of 7 p\.m\. at 14/, "winter or spring break: 9 p.m. is too late at 14");
  const tiles = [...document.querySelectorAll("#aSchool + .tp .tile")].map((b) => b.textContent);
  assert.deepEqual(tiles, ["School is in session", "Summer break", "Another school break"]);
});

test("F8: a below-federal state wage says 'pay the federal rate instead' once, since wageLine adds it", async () => {
  const wages = json("data/state-wages.json");
  for (const s of wages.states) if (s.below_federal) assert.ok(!s.wage.includes(FED), s.id + ": the wage text repeats the sentence wageLine adds");
  const p = await loadPage("permit.html"); await tick();
  const G = p.window.TIG;
  for (const s of wages.states) {
    const line = G.wageLine(wages, s.id);
    assert.ok(line.split(FED).length - 1 <= 1, s.id + " says it more than once: " + line);
    if (s.below_federal) assert.ok(line.includes(FED), s.id + " says it once");
  }
});

test("F4: the parents page permit note matches the finder: 17 full states and BC, 33 more and DC under Another state", () => {
  const note = json("data/parents.json").sign.note.t;
  assert.match(note, /17 states and British Columbia/);
  assert.match(note, /33 more states and Washington, DC/);
  assert.match(note, /"Another state"/);
  assert.match(note, /"My state is not listed"/);
  assert.doesNotMatch(note, /so far/);
  const finder = read("src/permit.html");
  assert.match(finder, /Pick &ldquo;Another state&rdquo; to find yours/, "the finder still calls it Another state");
});

test("F2: no British Columbia answer points to a US federal rule, since US rules do not apply in Canada", () => {
  const bc = json("data/permits.json").states.bc;
  const all = JSON.stringify(bc);
  assert.doesNotMatch(all, /federal fact sheet|Fact Sheet 71|FLSA/i);
  assert.match(bc.kinds.intern.text, /US rules do not apply in Canada/);
  assert.match(bc.kinds.intern.text, /BC Employment Standards Branch/);
});

test("F5: every 'British Columbia work permit answer' link opens the finder on British Columbia", () => {
  let n = 0;
  for (const f of fs.readdirSync(new URL("src/", ROOT)).filter((x) => x.endsWith(".html"))) {
    for (const m of read("src/" + f).matchAll(/<a href="([^"]*)">([^<]*British Columbia work permit[^<]*)<\/a>/g)) {
      assert.equal(m[1], "permit.html?state=bc", f + ": " + m[2]);
      n++;
    }
  }
  assert.ok(n >= 2, "paycheck and ready both link it");
  assert.ok(json("data/permits.json").states.bc, "permit.js reads ?state=bc from permits.json");
});

test("F5: permit.html?state=bc opens on British Columbia", async () => {
  const p = await loadPage("permit.html", { search: "?state=bc" });
  await waitFor(() => p.document.getElementById("pState").value === "bc", { timeout: 30000 });
  assert.equal(p.document.getElementById("pState").value, "bc");
});

test("F9: the Cook County pointer on the parents page goes to the Illinois section, where the Cook County rate is", () => {
  const pay = json("data/parents.json").money.pay;
  const cook = pay.find((s) => /Cook County outside Chicago/.test(s.t));
  assert.equal(cook.p, "states.html#illinois");
  const states = read("states.html");
  const at = states.indexOf('<section id="illinois">'), next = states.indexOf("<section", at + 10);
  assert.ok(at > 0, "states.html has an Illinois section");
  assert.match(states.slice(at, next > 0 ? next : undefined), /<b>Cook County<\/b> outside Chicago/);
});

test("F10: the contribute page does not ask for a map now that map.html exists", () => {
  assert.ok(fs.existsSync(new URL("map.html", ROOT)));
  assert.doesNotMatch(read("src/contribute.html"), /add a map/);
});
