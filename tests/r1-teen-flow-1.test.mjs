// Ticket r1-teen-flow-1: Home puts the age picker right under the hero, and links Parents and Safe at work from the youth callout.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadHome() {
  const page = await loadPage("index.html");
  await tick(120);
  return page;
}

test("r1-teen-flow-1: main sections run hero, start, soon, secret, moves, offer, young", async () => {
  const { document, errors } = await loadHome();

  const main = document.querySelector("main");
  assert.ok(main, "page has a main element");
  const order = [...main.querySelectorAll(":scope > section")].map((s) => s.id || "(hero)");
  assert.deepEqual(order, ["(hero)", "start", "soon", "secret", "moves", "offer", "young"]);
  assert.deepEqual(errors, [], "no script errors on the page");
});

test("r1-teen-flow-1: the age picker section is the second section, right under the hero", async () => {
  const { document, errors } = await loadHome();

  const main = document.querySelector("main");
  const second = main.querySelectorAll(":scope > section")[1];
  assert.equal(second.id, "start", "#start is the second section");
  assert.ok(second.querySelector("#pAge"), "the age picker sits inside #start");
  assert.deepEqual(errors, [], "no script errors on the page");
});

test("r1-teen-flow-1: Parents and Safe at work are plain links inside the youth callout", async () => {
  const { document, errors } = await loadHome();

  const young = document.getElementById("young");
  assert.ok(young, "#young exists");
  const parents = young.querySelectorAll('a[href="parents.html"]');
  const safety = young.querySelectorAll('a[href="safety.html"]');
  assert.equal(parents.length, 1, "exactly one parents.html link inside #young");
  assert.equal(safety.length, 1, "exactly one safety.html link inside #young");
  assert.equal(parents[0].textContent.trim(), "For parents");
  assert.equal(safety[0].textContent.trim(), "Safe at work");
  assert.ok(!parents[0].classList.contains("btn"), "parents link is not a button");
  assert.ok(!safety[0].classList.contains("btn"), "safety link is not a button");

  assert.equal(document.querySelectorAll('main a[href="parents.html"]').length, 1, "one parents.html link in main");
  assert.equal(document.querySelectorAll('main a[href="safety.html"]').length, 2, "safety.html in the youth callout and in the Got a yes next steps");
  assert.deepEqual(errors, [], "no script errors on the page");
});

test("r1-teen-flow-1: #offer and #soon keep exactly one a.btn each for home.js linkAge()", async () => {
  const { document, errors } = await loadHome();

  assert.equal(document.querySelectorAll("#offer a.btn").length, 1, "one a.btn inside #offer");
  assert.equal(document.querySelectorAll("#soon a.btn").length, 1, "one a.btn inside #soon");
  assert.deepEqual(errors, [], "no script errors on the page");
});

test("r1-teen-flow-1: the built index.html has no em dash or en dash", () => {
  const text = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const src = fs.readFileSync(path.join(ROOT, "src", "index.html"), "utf8");
  for (const [name, body] of [["index.html", text], ["src/index.html", src]]) {
    assert.ok(!body.includes("\u2014"), name + " has an em dash");
    assert.ok(!body.includes("\u2013"), name + " has an en dash");
  }
});
