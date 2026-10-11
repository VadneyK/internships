// Cook County wording. The $15.40 rate and the Cook County page are for workers 18 and older.
// Every sentence that names $15.40 or Cook County in src/states.html, data/parents.json and
// data/money.json must say "18 and older", and no text may say "youth rate applies" (the source
// does not say the youth rate applies to Cook County workers).
// Link labels inside <a> tags are skipped: a bare "Cook County" link name is a source label, not a claim.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TRIGGERS = ["$15.40", "Cook County"];
const REQUIRED = "18 and older";
const BANNED = "youth rate applies";

function sentencesOf(text) {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

// Text of an HTML file with link labels, scripts and styles removed.
function htmlClaimText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

// Every string value in a parsed JSON file, with its path for error messages.
function jsonStrings(value, path = "$", out = []) {
  if (typeof value === "string") out.push({ path, text: value });
  else if (Array.isArray(value)) value.forEach((v, i) => jsonStrings(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) jsonStrings(v, `${path}.${k}`, out);
  }
  return out;
}

function checkText(label, text, found) {
  const problems = [];
  if (text.includes(BANNED)) problems.push(`${label}: contains "${BANNED}"`);
  for (const s of sentencesOf(text)) {
    if (!TRIGGERS.some((t) => s.includes(t))) continue;
    found.count += 1;
    if (!s.includes(REQUIRED)) problems.push(`${label}: no "${REQUIRED}" in sentence: ${s.slice(0, 160)}`);
  }
  return problems;
}

test("src/states.html: Cook County sentence says the ordinance does not cover workers under 18", () => {
  const text = htmlClaimText(readFileSync(join(ROOT, "src/states.html"), "utf8"));
  assert.ok(!text.includes(BANNED), `contains "${BANNED}"`);
  assert.ok(
    text.includes("The Cook County ordinance does not cover workers under 18. Under 18, use the Illinois rates above."),
    "missing the Cook County under-18 sentences",
  );
});

test("data/parents.json: $15.40 and Cook County sentences say 18 and older", () => {
  const data = JSON.parse(readFileSync(join(ROOT, "data/parents.json"), "utf8"));
  const found = { count: 0 };
  const problems = jsonStrings(data).flatMap(({ path, text }) =>
    checkText(`data/parents.json ${path}`, text, found),
  );
  assert.deepEqual(problems, []);
  assert.ok(found.count >= 1, "expected at least one checked sentence");
});

test("data/money.json: $15.40 and Cook County sentences say 18 and older", () => {
  const data = JSON.parse(readFileSync(join(ROOT, "data/money.json"), "utf8"));
  const found = { count: 0 };
  const problems = jsonStrings(data).flatMap(({ path, text }) =>
    checkText(`data/money.json ${path}`, text, found),
  );
  assert.deepEqual(problems, []);
  assert.ok(found.count >= 2, `expected at least two checked sentences, got ${found.count}`);
});

test("the Cook County sentence in src/states.html has no read date and points to the Illinois rates", () => {
  const html = readFileSync(join(ROOT, "src/states.html"), "utf8");
  assert.ok(!html.includes("(Cook County page read Oct 10, 2026)"), "read date should be dropped");
  assert.ok(html.includes("Under 18, use the Illinois rates above."), "missing the under-18 pointer");
});
