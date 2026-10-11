// r1-accuracy-5: data/interview.json must not state as a rule that volunteering
// counts as job history. The Minnesota CareerForce page only lists volunteer
// experience as something to put on an application. Babysitting, yard work and
// club roles are our suggestion, and appSource[2].note says so.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const interview = JSON.parse(readFileSync(join(here, "..", "data", "interview.json"), "utf8"));

test("interview.json has no sentence saying volunteering counts as job history", () => {
  const all = JSON.stringify(interview);
  assert.doesNotMatch(all, /counts as job history/);
});

test("app[2] attributes the volunteer point to Minnesota CareerForce", () => {
  const line = interview.app[2];
  assert.equal(typeof line, "string");
  assert.match(line, /Minnesota CareerForce/);
  assert.match(line, /lists volunteer experience as something to put on an application\./);
});

test("appSource[2] still marks babysitting, yard work and club roles as our suggestion", () => {
  const note = interview.appSource[2].note;
  assert.match(note, /lists volunteer experience/);
  assert.match(note, /Babysitting, yard work and club roles are our suggestion, not from a source\./);
});
