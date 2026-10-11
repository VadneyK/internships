import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage } from "./dom-helper.mjs";

const root = new URL("../", import.meta.url);
const exists = (href) => fs.existsSync(new URL(href, root));

test("jobs: next step keeps the permit button and links to resume and interview", async () => {
  const { document } = await loadPage("jobs.html");
  const links = [...document.querySelectorAll("#next-step a")];
  const byText = Object.fromEntries(links.map((a) => [a.textContent.trim(), a.getAttribute("href")]));
  assert.equal(byText["Find your work permit"], "permit.html");
  assert.equal(byText["Build a first resume"], "resume.html");
  assert.equal(byText["Practice the interview"], "interview.html");
  for (const a of links) assert.ok(exists(a.getAttribute("href")), a.getAttribute("href") + " exists");
});

test("interview: next step points to jobs.html with the plain sentence", async () => {
  const { document } = await loadPage("interview.html");
  const next = document.querySelector("#next-step");
  const link = [...next.querySelectorAll("a")].find((a) => a.getAttribute("href") === "jobs.html");
  assert.ok(link, "link to jobs.html");
  assert.equal(link.textContent.trim(), "jobs that hire teens");
  assert.match(next.textContent.replace(/\s+/g, " "), /Need somewhere to apply\? See jobs that hire teens\./);
  for (const a of next.querySelectorAll("a")) assert.ok(exists(a.getAttribute("href")), a.getAttribute("href") + " exists");
});

test("jobs and interview sources add no em or en dash", () => {
  for (const f of ["src/jobs.html", "src/interview.html", "jobs.html", "interview.html"]) {
    const text = fs.readFileSync(new URL(f, root), "utf8");
    assert.doesNotMatch(text, /[\u2013\u2014]/, f);
  }
});
