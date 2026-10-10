// Ticket r1-teen-flow-6: Home hero in plain words. Short lede that says what a teen can do, and a second stat that is a number.
// Run with: node --test tests/r1-teen-flow-6.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";

const EM_DASH = "\u2014";
const EN_DASH = "\u2013";

async function loadHome() {
  const page = await loadPage("index.html");
  await tick(120);
  return page;
}

test("r1-teen-flow-6: hero lede is at most 40 words", async () => {
  const { document, errors } = await loadHome();
  const lede = document.querySelector(".hero .lede");
  assert.ok(lede, "hero has a .lede paragraph");
  const words = lede.textContent.trim().split(/\s+/).filter(Boolean);
  assert.ok(words.length <= 40, `lede has ${words.length} words, want at most 40`);
  assert.deepEqual(errors, [], "no script errors on the page");
});

test("r1-teen-flow-6: hero lede keeps the accuracy phrase and tells a teen to pick an age", async () => {
  const { document } = await loadHome();
  const text = document.querySelector(".hero .lede").textContent;
  assert.ok(text.includes("with the deadlines we could confirm"), "lede keeps the exact accuracy phrase");
  assert.equal(text.includes("real deadlines"), false, "lede does not promise real deadlines");
  assert.ok(/Pick your age/.test(text), "lede tells the teen to pick their age");
  assert.ok(/asking a person/.test(text), "lede names the one move: asking a person");
});

test("r1-teen-flow-6: hero lede has no city or state list", async () => {
  const { document } = await loadHome();
  const text = document.querySelector(".hero .lede").textContent;
  for (const place of ["Atlanta", "California", "New York", "Chicago", "Texas", "Ohio", "Pennsylvania"]) {
    assert.equal(text.includes(place), false, `lede does not name ${place}`);
  }
});

test("r1-teen-flow-6: hero has exactly three stats and none starts with Many", async () => {
  const { document } = await loadHome();
  const stats = [...document.querySelectorAll(".hero .stats .stat")];
  assert.equal(stats.length, 3, "three .stat blocks in the hero");
  for (const s of stats) {
    assert.equal(s.querySelector("b").textContent.trim().startsWith("Many"), false, "no stat starts with Many");
  }
});

test("r1-teen-flow-6: second stat is 12 to 18 ages the picker covers", async () => {
  const { document } = await loadHome();
  const second = document.querySelectorAll(".hero .stats .stat")[1];
  assert.equal(second.querySelector("b").textContent.trim(), "12 to 18");
  assert.equal(second.querySelector("span").textContent.trim(), "ages the picker covers");
});

test("r1-teen-flow-6: the picker age select really has options 12 to 18", async () => {
  const { document } = await loadHome();
  const values = [...document.querySelectorAll("#pAge option")].map((o) => o.value).filter((v) => v !== "");
  assert.deepEqual(values, ["12", "13", "14", "15", "16", "17", "18"]);
});

test("r1-teen-flow-6: first and last stats keep their text and the count placeholder is filled", async () => {
  const { document } = await loadHome();
  const stats = [...document.querySelectorAll(".hero .stats .stat")];
  assert.match(stats[0].querySelector("b").textContent.trim(), /^\d+$/, "first stat shows a whole number");
  assert.equal(stats[0].querySelector("span").textContent.trim(), "programs checked");
  assert.equal(stats[2].querySelector("b").textContent.trim(), "$0");
  assert.equal(stats[2].querySelector("span").textContent.trim(), "no sign-up, no tracking");
});

test("r1-teen-flow-6: index.html and its source have no em dash or en dash", () => {
  for (const rel of ["index.html", "src/index.html"]) {
    const text = fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
    assert.equal(text.includes(EM_DASH), false, `${rel} has no em dash`);
    assert.equal(text.includes(EN_DASH), false, `${rel} has no en dash`);
  }
});
