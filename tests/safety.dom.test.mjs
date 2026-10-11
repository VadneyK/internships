import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";
const D = JSON.parse(fs.readFileSync(new URL("../data/safety.json", import.meta.url), "utf8"));
const digits = (s) => String(s).replace(/\D/g, "");

test("safety data: sections, points, hotlines and gaps are all filled in", () => {
  assert.equal(D.sections.length, 6);
  assert.deepEqual(D.sections.map((s) => s.id), ["rights", "hazards", "harassment", "injuries", "retaliation", "call"]);
  for (const s of D.sections) {
    assert.ok(s.title && s.plain, s.id);
    assert.ok(s.points.length > 0, s.id);
    for (const p of s.points) {
      assert.ok(p.text && p.quote && p.source, s.id + ": " + JSON.stringify(p));
      assert.match(p.url, /^https:\/\//, p.url);
    }
  }
  assert.ok(D.hotlines.length >= 10);
  assert.ok(D.gaps.length > 0);
  assert.ok(D.start.steps.length >= 3);
});

test("safety data: every hotline has a real phone number, and each tel matches the number shown", () => {
  for (const h of D.hotlines) {
    assert.ok(digits(h.phone).length >= 10, h.name);
    assert.match(h.url, /^https:\/\//, h.name);
    assert.ok(h.numbers.length > 0, h.name);
    for (const n of h.numbers) {
      assert.match(n.tel, /^\+1\d{10}$/, h.name + " " + n.tel);
      assert.ok(digits(n.display + " " + h.phone).includes(n.tel.slice(-7)), h.name + ": " + n.display + " does not match " + n.tel);
    }
  }
  assert.equal(D.hotlines.filter((h) => h.top).length, 3, "three national numbers sit at the top");
});

test("safety page: loads clean, renders every section, point and hotline", async () => {
  const { document, errors } = await loadPage("safety.html"); await tick(200);
  assert.deepEqual(errors, []);
  for (const s of D.sections) {
    const el = document.getElementById("sec-" + s.id);
    assert.ok(el, "section " + s.id);
    assert.equal(el.querySelector("h2").textContent, s.title);
  }
  const points = D.sections.reduce((n, s) => n + s.points.length, 0);
  assert.equal(document.querySelectorAll("main article.card").length, points);
  assert.equal(document.querySelectorAll("#sec-call ul > li").length, D.hotlines.length);
  assert.equal(document.querySelectorAll("#sSteps li").length, D.start.steps.length);
  assert.equal(document.querySelectorAll("#sTop li").length, 3);
  assert.equal(document.querySelectorAll("#sGaps li").length, D.gaps.length);
  assert.doesNotMatch(document.body.textContent, /undefined|NaN|\{\{/);
});

test("safety page: every outside link is https, opens in a new tab and has rel noopener", async () => {
  const { document } = await loadPage("safety.html"); await tick(200);
  const out = [...document.querySelectorAll('a[target="_blank"]')];
  assert.ok(out.length >= 80, "source links: " + out.length);
  for (const a of out) {
    assert.match(a.getAttribute("href"), /^https:\/\//);
    assert.match(a.getAttribute("rel") || "", /noopener/);
  }
  for (const a of document.querySelectorAll("main a[target=_blank], #sSteps a, #sTop a")) {
    const h = a.getAttribute("href");
    assert.ok(/^https:\/\//.test(h) || /^tel:\+1\d{10}$/.test(h), h);
  }
});

test("safety page: hotlines are tel links with digits, grouped by place", async () => {
  const { document } = await loadPage("safety.html"); await tick(200);
  const tels = [...document.querySelectorAll('#sec-call a[href^="tel:"]')];
  assert.equal(tels.length, D.hotlines.reduce((n, h) => n + h.numbers.length, 0));
  for (const a of tels) assert.ok(digits(a.textContent).length >= 10, a.textContent);
  assert.deepEqual([...document.querySelectorAll("#sec-call h3")].map((h) => h.textContent).slice(0, 5), ["National", "California", "Georgia", "New York", "Illinois"]);
  assert.ok(document.querySelectorAll('#sTop a[href^="tel:"]').length >= 3);
});

test("safety page: says tell a trusted adult, not legal advice, and lists what we could not find", async () => {
  const { document } = await loadPage("safety.html"); await tick(200);
  const text = document.body.textContent;
  assert.match(document.getElementById("sStartH").textContent, /trusted adult/i);
  assert.match(text, /summary of official pages, not legal advice/);
  assert.match(document.getElementById("sec-gaps").querySelector("h2").textContent, /could not find/i);
  assert.ok(document.querySelectorAll("#sGaps li").length >= 3);
});

test("safety page: the On this page chips all point at a section on the page", async () => {
  const { document } = await loadPage("safety.html"); await tick(200);
  const chips = [...document.querySelectorAll('nav[aria-label="On this page"] a')];
  assert.equal(chips.length, 8); // the seven sections plus Words you will see (r3-teen-flow-5)
  for (const c of chips) assert.ok(document.querySelector(c.getAttribute("href")), c.getAttribute("href"));
});

test("safety page: sits under Get ready", async () => {
  const { document } = await loadPage("safety.html"); await tick(100);
  assert.match(document.querySelector('nav a[aria-current="page"]').textContent, /Get ready/);
  const crumb = document.querySelector('nav[aria-label="Breadcrumb"]');
  assert.equal(crumb.querySelector("a").getAttribute("href"), "ready.html");
  assert.equal(crumb.querySelector('[aria-current="page"]').textContent, "Safe at work");
});

test("safety page: the footer, Get ready and Rules link to it", async () => {
  for (const f of ["ready.html", "rules.html", "paycheck.html"]) {
    const { document } = await loadPage(f); await tick(50);
    assert.ok(document.querySelector('a[href="safety.html"]'), f);
  }
  const { document } = await loadPage("ready.html");
  assert.ok(document.querySelector('.foot a[href="safety.html"]'));
});
