// Data integrity: status must agree with the deadline and opens dates.
// Reads data/programs/*.json and data/meta.json. "Today" is meta.checked, never the real clock. No network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "data", "programs");
const CHECKED = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "meta.json"), "utf8")).checked;
const PROGRAMS = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")));

// Known bad records. Each id maps to the rules it breaks today.
// The data lane must fix status, then delete this line.
const ALLOW = {
  // Same fix needed: these three are unconfirmed but carry a deadline_iso. Fix the data, then delete these lines.
  "pittsburgh-cmu-cs-scholars": ["undated-status-has-deadline"],
  "pittsburgh-cmu-pre-college-programs": ["undated-status-has-deadline"],
  "pittsburgh-cmu-summer-academy-math-science": ["undated-status-has-deadline"],
};

const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Returns the list of rule names this program breaks.
function violations(p) {
  const out = [];
  const { status, deadline_iso: dl, opens_iso: op, deadline_text: dt } = p;
  if ((status === "open-now" || status === "opens-soon") && isDate(dl) && dl < CHECKED) out.push("deadline-before-checked");
  if (status === "opens-soon" && isDate(op) && isDate(dl) && op > dl) out.push("opens-after-deadline");
  if (isDate(op) && isDate(dl) && !(op < dl)) out.push("opens-not-before-deadline");
  if ((status === "rolling" || status === "year-round" || status === "unconfirmed") && dl) out.push("undated-status-has-deadline");
  if (status === "event" && !dl && !(dt && String(dt).trim())) out.push("event-has-no-date");
  return out;
}

test("meta.checked is a real date and programs were loaded", () => {
  assert.ok(isDate(CHECKED), "data/meta.json checked must be YYYY-MM-DD");
  assert.ok(PROGRAMS.length > 0, "no programs found in data/programs");
});

test("status agrees with deadline_iso and opens_iso for every program", () => {
  const problems = [];
  for (const p of PROGRAMS) {
    const allowed = ALLOW[p.id] || [];
    for (const rule of violations(p)) {
      if (!allowed.includes(rule)) problems.push(`${p.id}: ${rule} (status=${p.status}, opens_iso=${p.opens_iso}, deadline_iso=${p.deadline_iso}, checked=${CHECKED})`);
    }
  }
  assert.deepEqual(problems, [], "Fix the status or dates for:\n" + problems.join("\n"));
});

test("ALLOW list ids still break the rule (remove an id once its data is fixed)", () => {
  const byId = new Map(PROGRAMS.map((p) => [p.id, p]));
  for (const [id, rules] of Object.entries(ALLOW)) {
    const p = byId.get(id);
    assert.ok(p, `${id} is in ALLOW but no longer exists in data/programs, delete it from ALLOW`);
    const found = violations(p);
    for (const rule of rules) {
      assert.ok(found.includes(rule), `${id} no longer breaks ${rule}, delete it from ALLOW`);
    }
  }
});
