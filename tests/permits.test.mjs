// r3-accuracy-1: a permit:false answer says "no permit needed" for the kind.
// If the text says the rule is not stated or not said, the answer must be null
// (check first), otherwise the finder states more than the source text does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PERMITS = JSON.parse(readFileSync(join(root, "data", "permits.json"), "utf8"));

// Entries to check: each state's kind answers, plus any per-age "under" override.
function answers() {
  const out = [];
  for (const [st, s] of Object.entries(PERMITS.states)) {
    for (const [kind, k] of Object.entries(s.kinds || {})) {
      out.push({ where: `${st}.${kind}`, entry: k });
      if (k.under) out.push({ where: `${st}.${kind}.under`, entry: k.under });
    }
  }
  return out;
}

test("no kinds entry with permit:false says 'not stated' or 'do not say'", () => {
  const bad = answers().filter(({ entry }) => entry.permit === false && /not stated|do not say/i.test(entry.text || ""));
  assert.deepEqual(bad.map((b) => b.where), [], "permit:false entries whose text says the rule is not stated; use permit null");
});

test("New York odd jobs is check first (permit null) and keeps its sourced text", () => {
  const odd = PERMITS.states.ny.kinds.odd;
  assert.equal(odd.permit, null);
  assert.match(odd.text, /Yard work for 12 and 13 year olds is not stated\./);
  assert.match(odd.text, /the babysitter must be at least 14/);
});
