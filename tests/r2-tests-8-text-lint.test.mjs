// r2-tests-8: text lint for stray repeats and punctuation in data strings and page text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Pairs that are real English. Key is the lowercase pair, value is why it is fine.
export const REPEAT_OK = {
  "in in-demand": "in followed by the hyphenated word in-demand",
  "works works": "Works is a name or noun followed by the verb works",
};

// Every string value in a parsed JSON value, with a path for messages.
export function collectStrings(v, path = "$", out = []) {
  if (typeof v === "string") out.push([path, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => collectStrings(x, `${path}[${i}]`, out));
  else if (v && typeof v === "object") for (const k of Object.keys(v)) collectStrings(v[k], `${path}.${k}`, out);
  return out;
}

// Visible text of an html file: no script, style or tags, entities left alone.
export function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/?(a|em|strong|b|i|span|code|small|mark|abbr|u)\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "\u0001")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

export function lintText(text, { field = "" } = {}) {
  const problems = [];
  const re = /\b([A-Za-z]{3,})\s+\1\b(-[A-Za-z]+)?/gi;
  let m;
  while ((m = re.exec(text))) {
    const pair = m[0].toLowerCase().replace(/\s+/g, " ");
    if (!REPEAT_OK[pair] && !REPEAT_OK[(m[1] + " " + m[1]).toLowerCase()]) problems.push(`repeated word "${m[0]}"`);
    re.lastIndex = m.index + m[1].length;
  }
  // in-demand style: "in in-demand" is matched by neither pass because of the hyphen guard, but check the OK list too.
  if (/ [,.;:](?!\.\.)/.test(text)) problems.push("space before , . ; or :");
  if (/,,/.test(text) || /(^|[^.])\.\.($|[^.])/.test(text) || /\.{4,}/.test(text)) problems.push("doubled comma or period");
  if (field !== "sources_fetched" && /http:\/\//i.test(text)) problems.push("plain http:// link");
  // Walk the brackets. A ")" with nothing open that follows 1 or 2 digits at a word start is a numbered step like 1).
  let depth = 0;
  let unbalanced = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(") depth++;
    else if (c === ")") {
      if (depth > 0) depth--;
      else if (!/(^|[\s])\d{1,2}$/.test(text.slice(0, i))) unbalanced = true;
    }
  }
  if (depth > 0 || unbalanced) problems.push("unbalanced round brackets");
  return problems;
}

const jsonFiles = [];
for (const f of readdirSync(join(root, "data"))) {
  if (f.endsWith(".json") && !f.startsWith("entries")) jsonFiles.push(join("data", f));
}
for (const f of readdirSync(join(root, "data/programs"))) {
  if (f.endsWith(".json")) jsonFiles.push(join("data/programs", f));
}

test("data strings have no repeated words or stray punctuation", () => {
  const bad = [];
  for (const f of jsonFiles) {
    const data = JSON.parse(readFileSync(join(root, f), "utf8"));
    for (const [p, s] of collectStrings(data)) {
      const field = p.split(".").pop().replace(/\[\d+\]/g, "");
      const inFetched = /sources_fetched/.test(p);
      for (const pr of lintText(s, { field: inFetched ? "sources_fetched" : field })) bad.push(`${f} ${p}: ${pr}: ${s.slice(0, 80)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("src html visible text has no repeated words or stray punctuation", () => {
  const bad = [];
  for (const f of readdirSync(join(root, "src")).filter((x) => x.endsWith(".html"))) {
    const text = visibleText(readFileSync(join(root, "src", f), "utf8"));
    for (const pr of lintText(text)) bad.push(`src/${f}: ${pr}`);
  }
  assert.deepEqual(bad, []);
});

// Seeded-bad fixtures: each rule must fire, and clean text must pass.
test("lint catches a repeated word, case blind", () => {
  assert.ok(lintText("A four-day day program").length);
  assert.ok(lintText("You take The the course").length);
  assert.ok(lintText("You take one one-week course").length);
});
test("lint allows listed repeats and short words", () => {
  assert.deepEqual(lintText("Jobs in in-demand fields"), []);
  assert.deepEqual(lintText("Veteran Works works well"), []);
  assert.deepEqual(lintText("It is on on"), []);
});
test("lint catches a space before punctuation", () => {
  for (const s of ["Hello , there", "End .", "a ; b", "Note :"]) assert.ok(lintText(s).length, s);
});
test("lint catches doubled commas and periods but allows three dots", () => {
  assert.ok(lintText("one,, two").length);
  assert.ok(lintText("Done..").length);
  assert.deepEqual(lintText("Wait... what"), []);
  assert.deepEqual(lintText("I am curious about ..."), []);
});
test("lint catches http:// outside sources_fetched", () => {
  assert.ok(lintText("see http://example.org").length);
  assert.deepEqual(lintText("http://example.org", { field: "sources_fetched" }), []);
  assert.deepEqual(lintText("https://example.org"), []);
});
test("lint catches unbalanced brackets but not numbered steps", () => {
  assert.ok(lintText("Open (the door").length);
  assert.ok(lintText("close the door)").length);
  assert.deepEqual(lintText("1) Wake up 2) Eat (maybe)"), []);
});
