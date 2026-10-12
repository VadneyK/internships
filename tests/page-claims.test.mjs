import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const permits = JSON.parse(read("data/permits.json"));

const HEDGE = /\b(many|depends?|some|most|usually)\b/i;
const CLAIM = /\b(a parent|parents?|your parent|a guardian)\s+(signs|has to sign|must sign)\s+(the|a|your)\s+permit\b/i;
const NO_PERMIT = /\bno (work )?permit\b|does not issue|employer[- ](holds?|gets|keeps|starts)|employer-held/i;

const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;|&#\d+;/g, " ").replace(/\s+/g, " ");
const sentences = (s) => s.split(/(?<=[.!?])\s+/);

// Returns a list of unhedged "parent signs the permit" sentences.
export function unhedgedSignClaims(html) {
  return sentences(text(html)).filter((s) => CLAIM.test(s) && !HEDGE.test(s));
}

// State codes whose card says there is no permit, or the employer holds it.
export function statesWithoutParentPermit(data) {
  return Object.entries(data.states)
    .filter(([, c]) => NO_PERMIT.test(c.adult || "") || NO_PERMIT.test(c.issuer || ""))
    .map(([k]) => k);
}

// Pulls the hire shares from the home chart label, and the section text.
export function referralProblems(html) {
  const sec = html.split(/<section\b/).find((s) => /referral/i.test(s) && /class="bars"/.test(s)) || "";
  const label = (sec.match(/class="bars"[^>]*aria-label="([^"]*)"/) || [])[1] || "";
  const hires = (name) => {
    const m = label.match(new RegExp(name + ":.*?(\\d+(?:\\.\\d+)?) percent of hires", "i"));
    return m ? parseFloat(m[1]) : NaN;
  };
  const ref = hires("Referrals"), jobs = hires("Job sites");
  const out = [];
  if (Number.isNaN(ref) || Number.isNaN(jobs)) return ["could not read the bar data"];
  const body = text(sec.replace(/<figure[\s\S]*?<\/figure>/, ""));
  if (jobs > ref && /\bbeats?\b[^.]*job sites|better than job sites|more than job sites/i.test(body)) {
    out.push("claims referrals beat job sites but job sites have " + jobs + "% of hires vs " + ref + "%");
  }
  return out;
}

const pages = fs.readdirSync(path.join(root, "src")).filter((f) => f.endsWith(".html"));

test("r3-accuracy-7: no page says a parent signs the permit without a hedge when some states differ", () => {
  const exceptions = statesWithoutParentPermit(permits);
  assert.ok(exceptions.length > 0, "permits.json should have states with no or employer-held permits");
  const bad = [];
  for (const f of pages) for (const s of unhedgedSignClaims(read("src/" + f))) bad.push(f + ": " + s);
  assert.deepEqual(bad, []);
});

test("r3-accuracy-7: home referral section does not out-claim the bar data", () => {
  assert.deepEqual(referralProblems(read("src/index.html")), []);
});

test("r3-accuracy-7: negative control, old wording is caught", () => {
  assert.equal(unhedgedSignClaims("<p>A parent signs the permit. Show them this answer:</p>").length, 1);
  assert.equal(unhedgedSignClaims("<p>In many states a parent signs the permit.</p>").length, 0);
  const old = '<section><h2>People beat job sites</h2><p>x referral</p><div class="bars" role="img" aria-label="Referrals: 1.6 percent of applications and 17.1 percent of hires. Job sites: 49 percent of applications and 24.6 percent of hires."></div></section>';
  assert.equal(referralProblems(old).length, 1);
});
