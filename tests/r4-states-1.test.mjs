import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const lite = JSON.parse(readFileSync(join(repo, "data/states-lite.json"), "utf8"));
const permits = JSON.parse(readFileSync(join(repo, "data/permits.json"), "utf8"));
const $ = (p, id) => p.document.getElementById(id);
/* The two letter code for each state name. A row in states-lite.json must use the code for its own name. */
const STATE_CODE = {
  Alabama: "al", Alaska: "ak", Arizona: "az", Arkansas: "ar", California: "ca", Colorado: "co", Connecticut: "ct", Delaware: "de",
  "District of Columbia": "dc", Florida: "fl", Georgia: "ga", Hawaii: "hi", Idaho: "id", Illinois: "il", Indiana: "in", Iowa: "ia",
  Kansas: "ks", Kentucky: "ky", Louisiana: "la", Maine: "me", Maryland: "md", Massachusetts: "ma", Michigan: "mi", Minnesota: "mn",
  Mississippi: "ms", Missouri: "mo", Montana: "mt", Nebraska: "ne", Nevada: "nv", "New Hampshire": "nh", "New Jersey": "nj",
  "New Mexico": "nm", "New York": "ny", "North Carolina": "nc", "North Dakota": "nd", Ohio: "oh", Oklahoma: "ok", Oregon: "or",
  Pennsylvania: "pa", "Rhode Island": "ri", "South Carolina": "sc", "South Dakota": "sd", Tennessee: "tn", Texas: "tx", Utah: "ut",
  Vermont: "vt", Virginia: "va", Washington: "wa", "West Virginia": "wv", Wisconsin: "wi", Wyoming: "wy",
};
/* Rows the lite card shows, in order, with the stored field each one must print. */
const LITE_ROWS = [["Youngest age", "min_age"], ["Permit", "permit"], ["Hours", "hours"]];

test("states-lite: 34 entries, https url, short quote, new two letter id, no dash characters", () => {
  assert.equal(lite.states.length, 34);
  const seen = new Set();
  for (const s of lite.states) {
    assert.match(s.id, /^[a-z]{2}$/, s.id);
    assert.ok(!seen.has(s.id), "duplicate " + s.id); seen.add(s.id);
    assert.ok(!Object.prototype.hasOwnProperty.call(permits.states, s.id), s.id + " is already a full state");
    assert.match(s.url, /^https:\/\//, s.id);
    assert.ok(s.page_title && s.name && s.quote, s.id);
    assert.ok(s.quote.split(/\s+/).length <= 15, s.id + " quote is too long");
    assert.equal(STATE_CODE[s.name], s.id, s.id + " does not match name " + s.name);
  }
  assert.ok(!/[\u2013\u2014]/.test(JSON.stringify(lite)), "dash character in states-lite.json");
});

test("permit: Another state then Oregon shows the Oregon card with its source link", async () => {
  const p = await loadPage("permit.html"); await tick();
  type(p.window, $(p, "pState"), "lite"); await tick();
  assert.equal($(p, "pLiteField").hidden, false);
  type(p.window, $(p, "pLite"), "or"); await tick();
  const out = $(p, "pOut");
  assert.match(out.querySelector("h2").textContent, /Oregon/);
  assert.match(out.textContent, /We mostly read one official page for this state/);
  const a = out.querySelector('a[href="https://www.oregon.gov/boli/employers/pages/minor-workers.aspx"]');
  assert.ok(a, "source link");
  assert.equal(a.getAttribute("target"), "_blank");
  assert.match(a.getAttribute("rel"), /noopener/);
  assert.ok(out.querySelector('a[href^="tel:"]'), "phone is a tel link");
  assert.equal($(p, "packetSec").hidden, true);
  assert.match(p.window.location.search, /state=or/);
  assert.deepEqual(p.errors, []);
});

test("permit: ?state=ak opens the card, fields without a fact are quiet, age 13 links to Ages 12 to 14", async () => {
  const p = await loadPage("permit.html", { search: "?state=ak&age=13" }); await tick();
  const out = $(p, "pOut");
  assert.match(out.querySelector("h2").textContent, /Alaska/);
  assert.match(out.textContent, /Phone: Not stated on the page we read/);
  assert.ok(!out.querySelector('a[href^="tel:"]'));
  assert.ok(out.querySelector('a[href^="younger.html"]'));
  assert.match(p.window.location.search, /state=ak/);
  assert.match(p.window.location.search, /age=13/);
});

test("permit: a field the page does not state gets the quiet style", async () => {
  const p = await loadPage("permit.html", { search: "?state=ct" }); await tick();
  const ns = $(p, "pOut").querySelector("dd.ns");
  assert.ok(ns);
  assert.equal(ns.textContent, "Not stated on the page we read.");
});

test("permit: age 18 shows the adult line, full states still work from ?state=", async () => {
  const p = await loadPage("permit.html", { search: "?state=fl&age=18" }); await tick();
  assert.ok($(p, "pOut").querySelector("#pAdultLine"));
  const q = await loadPage("permit.html", { search: "?state=ca&age=15&kind=job" }); await tick();
  assert.match($(q, "pOut").textContent, /Permit to Employ and Work/);
});

test("permit: My state is not listed in the second step gives the not-read answer", async () => {
  const p = await loadPage("permit.html"); await tick();
  type(p.window, $(p, "pState"), "lite"); await tick();
  type(p.window, $(p, "pLite"), "other"); await tick();
  assert.match($(p, "pOut").textContent, /have not read your state/);
});

test("states-lite: each quote is a verbatim substring of its stored source excerpt, from the fetched page", () => {
  for (const s of lite.states) {
    assert.equal(typeof s.source_excerpt, "string", s.id + " has no source_excerpt");
    assert.ok(s.source_excerpt.length >= s.quote.length, s.id);
    assert.ok(s.source_excerpt.includes(s.quote), s.id + " quote is not in source_excerpt");
  }
});

test("permit: a failed states-lite fetch shows the could-not-load message, then a retry shows the list", async () => {
  const p = await loadPage("permit.html"); await tick();
  const real = p.window.fetch;
  p.window.fetch = (u, o) => String(u).includes("states-lite") ? Promise.reject(new Error("offline")) : real(u, o);
  type(p.window, $(p, "pState"), "lite"); await tick(150);
  assert.match($(p, "pOut").textContent, /The shorter answers could not load/);
  assert.equal($(p, "pLiteField").hidden, true);
  assert.deepEqual(p.errors, []);
  p.window.fetch = real;
  type(p.window, $(p, "pState"), "lite"); await tick(150);
  assert.equal($(p, "pLiteField").hidden, false);
  assert.ok($(p, "pLite").querySelector('option[value="ak"]'), "list filled after retry");
});

test("permit: a 16 or 17 year old gets the card with the hours and permit rows and no 12 to 13 link", async () => {
  for (const age of ["16", "17"]) {
    const p = await loadPage("permit.html", { search: "?state=ak&age=" + age }); await tick();
    const out = $(p, "pOut");
    assert.match(out.querySelector("h2").textContent, /Alaska/);
    assert.ok(!out.querySelector("#pAdultLine"), age + " is not 18");
    assert.match(out.querySelector("#pLiteNote").textContent, /16 and 17/, age + " gets the 16 and 17 note");
    assert.ok(!out.querySelector('a[href^="younger.html"]'), age + " gets no 12 to 13 link");
    const labels = [...out.querySelectorAll("dl.facts dt")].map((d) => d.textContent);
    assert.deepEqual(labels.slice(0, 3), LITE_ROWS.map((r) => r[0]));
    assert.match(out.querySelector("dl.facts div:nth-child(3) dd").textContent, /\S/);
    assert.deepEqual(p.errors, []);
  }
});

test("permit: for each state at age 14 and 15, every row prints its own stored field under its own label", async () => {
  const p = await loadPage("permit.html"); await tick();
  type(p.window, $(p, "pState"), "lite"); await tick(150);
  type(p.window, $(p, "pKind"), "job"); await tick();
  for (const age of ["14", "15"]) {
    type(p.window, $(p, "pAge"), age); await tick();
    for (const s of lite.states) {
      type(p.window, $(p, "pLite"), s.id); await tick(20);
      const out = $(p, "pOut");
      assert.equal(out.querySelector("h2").textContent, s.name, s.id);
      const rows = [...out.querySelectorAll("dl.facts > div")];
      assert.equal(rows.length, 4, s.id + " rows");
      LITE_ROWS.forEach(([label, field], i) => {
        assert.equal(rows[i].querySelector("dt").textContent, label, s.id + " label " + i);
        const dd = rows[i].querySelector("dd");
        if (s[field] === "Not stated on the page we read.") {
          assert.ok(dd.classList.contains("ns"), s.id + " " + field + " is quiet");
          assert.equal(dd.textContent, "Not stated on the page we read.", s.id);
        } else {
          assert.equal(dd.textContent, s[field], s.id + " " + field);
        }
      });
      assert.equal(rows[3].querySelector("dt").textContent, "Who to ask", s.id);
      assert.ok(rows[3].querySelector("dd").textContent.includes(s.who_to_ask), s.id + " who to ask");
      assert.ok(out.textContent.includes("\u201c" + s.quote + "\u201d"), s.id + " quote shown");
    }
  }
});
