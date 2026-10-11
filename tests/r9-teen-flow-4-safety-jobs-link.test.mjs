// Safe at work page: the next-step section links to jobs.html and interview.html, and both targets exist.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("safety page: next-step has the looking-for-work line with links to jobs and interview prep", async () => {
  const { document, errors } = await loadPage("safety.html"); await tick(200);
  assert.deepEqual(errors, []);
  const next = document.getElementById("next-step");
  assert.ok(next, "#next-step exists");
  const text = next.textContent.replace(/\s+/g, " ");
  assert.match(text, /Looking for a safe place to apply\? See jobs that hire teens/);

  const jobs = next.querySelector('a[href="jobs.html"]');
  assert.ok(jobs, "jobs.html link is inside #next-step");
  assert.equal(jobs.textContent.trim(), "See jobs that hire teens");

  const interview = next.querySelector('a[href="interview.html"]');
  assert.ok(interview, "interview.html link is inside #next-step");
  assert.ok(interview.textContent.trim().length > 0);

  assert.ok(fs.existsSync(path.join(ROOT, "jobs.html")), "jobs.html exists");
  assert.ok(fs.existsSync(path.join(ROOT, "interview.html")), "interview.html exists");
  assert.ok(next.querySelector('a[href="share.html"]'), "share link is still there");
});

test("safety page: no em dash or en dash characters in the built page", () => {
  const html = fs.readFileSync(path.join(ROOT, "safety.html"), "utf8");
  assert.doesNotMatch(html, /[\u2013\u2014]/);
});
