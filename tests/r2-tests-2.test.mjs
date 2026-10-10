// The number on each Insights chart row must agree with the count on the page its link opens.
// Run with: node --test tests/r2-tests-2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

const firstInt = (s) => parseInt(String(s).match(/\d+/)[0], 10);

async function landing(href) {
  const q = href.includes("?") ? "?" + href.split("?")[1] : "";
  const page = await loadPage("find.html", { search: q });
  // Under a loaded machine the list can still be fetching; wait for the real count.
  for (let i = 0; i < 100 && !/\d/.test(page.document.getElementById("count").textContent); i++) await tick(50);
  const text = page.document.getElementById("count").textContent;
  page.window.close();
  return firstInt(text);
}

test("Insights chart numbers agree with where their links land", async () => {
  const ins = await loadPage("insights.html");
  const doc = ins.document;
  const rows = [...doc.querySelectorAll(".crow, .ccol")].map((el) => ({
    el,
    label: el.querySelector(".cl")?.textContent.trim() || "",
    n: firstInt(el.querySelector(".cn").textContent),
    href: el.tagName === "A" ? el.getAttribute("href") : null,
  }));
  assert.ok(rows.length >= 40, "found chart rows");

  // (d) Dates not posted has no filter on the Programs page, so it is not a link.
  const unknown = rows.filter((r) => /dates not posted/i.test(r.label));
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0].href, null);
  assert.equal(unknown[0].el.tagName, "DIV");

  // (b) the plain sentence under the interest and season charts
  assert.match(doc.getElementById("fieldsNote").textContent, /any interest/i);
  assert.match(doc.getElementById("seasonNote").textContent, /any season/i);
  assert.doesNotMatch(doc.body.textContent, /[\u2013\u2014]/);

  const linked = rows.filter((r) => r.href);
  const open = linked.filter((r) => new URLSearchParams(r.href.split("?")[1] || "").get("when") === "open");
  const openSum = open.reduce((a, r) => a + r.n, 0);
  assert.equal(open.length, 2, "Open now and Opens soon");

  for (const r of linked) {
    const p = new URLSearchParams(r.href.split("?")[1] || "");
    const got = await landing(r.href);
    const tag = r.label + " -> " + r.href;
    if (p.get("when") === "open") assert.equal(got, openSum, tag);
    else if (p.get("interest") || p.get("season")) assert.ok(got >= r.n, tag + " landed " + got + " vs " + r.n);
    else assert.equal(got, r.n, tag);
  }
  ins.window.close();
});

test("Home picker 'See all N matches' agrees with find.html", async () => {
  const probe = await loadPage("index.html");
  const hubs = [...probe.document.getElementById("pHub").options].map((o) => o.value).filter(Boolean);
  const fields = [...probe.document.getElementById("pField").options].map((o) => o.value).filter(Boolean);
  probe.window.close();
  const combos = [
    ["13", "", ""], ["16", "", ""], ["", hubs[0], ""],
    ["15", hubs[1], ""], ["14", "", fields[0]], ["17", hubs[2], fields[1]],
  ];
  for (const [age, hub, field] of combos) {
    const page = await loadPage("index.html");
    const d = page.document;
    type(page.window, d.getElementById("pAge"), age);
    type(page.window, d.getElementById("pHub"), hub);
    type(page.window, d.getElementById("pField"), field);
    await tick(50);
    const a = d.querySelector("#matchMore a.btn");
    assert.ok(a, "link for " + [age, hub, field]);
    const n = firstInt(a.textContent);
    const got = await landing(a.getAttribute("href"));
    assert.equal(got, n, [age, hub, field].join("/") + " " + a.getAttribute("href"));
    page.window.close();
  }
});
