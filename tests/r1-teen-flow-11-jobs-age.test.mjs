// Ticket r1-teen-flow-1 (Jobs): ?age= and the saved Programs age. 12 and 13 select Under 14; the address wins over the saved age.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

async function jobsAt(search, storage) {
  const page = await loadPage("jobs.html", { search, storage });
  await tick(150);
  return page;
}

test("jobs ?age=13 and ?age=12 select Under 14 and show the under 14 card", async () => {
  for (const age of ["13", "12"]) {
    const { document, errors } = await jobsAt("?age=" + age);
    assert.equal(document.getElementById("jAge").value, "u14", "age " + age);
    assert.match(document.getElementById("jOut").textContent, /under 14/i, "age " + age);
    assert.match(document.getElementById("jStatus").textContent, /under 14/i, "age " + age);
    assert.deepEqual(errors, [], "no script errors for age " + age);
  }
});

test("jobs ?age=15 selects 15", async () => {
  const { document, errors } = await jobsAt("?age=15");
  assert.equal(document.getElementById("jAge").value, "15");
  assert.match(document.getElementById("jStatus").textContent, /age 15/);
  assert.deepEqual(errors, []);
});

test("jobs ?age=99 and ?age=abc leave the picker empty", async () => {
  for (const age of ["99", "abc"]) {
    const { document, errors } = await jobsAt("?age=" + age);
    assert.equal(document.getElementById("jAge").value, "", "age " + age);
    assert.equal(document.getElementById("jStatus").textContent, "", "age " + age);
    assert.deepEqual(errors, [], "no script errors for age " + age);
  }
});

test("jobs with no ?age= starts at the saved Programs age 16 (read only)", async () => {
  const storage = { findprefs: { age: "16", place: "" } };
  const { document, window, errors } = await jobsAt("", storage);
  assert.equal(document.getElementById("jAge").value, "16");
  assert.match(document.getElementById("jStatus").textContent, /age 16/);
  assert.deepEqual(JSON.parse(window.localStorage.getItem("findprefs")), storage.findprefs, "saved age is not rewritten");
  assert.deepEqual(errors, []);
});

test("jobs address wins over the saved age", async () => {
  const { document } = await jobsAt("?age=15", { findprefs: { age: "16", place: "" } });
  assert.equal(document.getElementById("jAge").value, "15");
});

test("jobs saved age 13 from Programs selects Under 14", async () => {
  const { document } = await jobsAt("", { findprefs: { age: "13", place: "" } });
  assert.equal(document.getElementById("jAge").value, "u14");
});
