// Sentence length and hard-word ceiling for teen-facing prose in data/*.json
// and the program text fields in data/entries.json.
// Rule: no sentence over 60 words, and no sentence with more than 6 words of
// 13 or more letters. Anything over is listed in KNOWN below with a reason and
// must shrink: a listed item that now passes fails the test.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_WORDS = 60;
const MAX_HARD = 6;
const HARD_LEN = 13;
const SKIP_KEYS = new Set(["url", "source", "read", "id"]);
const ENTRY_FIELDS = ["what_you_do", "who_can_apply", "how_to_apply"];

// Derived files (projections of entries.json) and non-prose files are skipped.
const files = fs.readdirSync(path.join(root, "data"))
  .filter((f) => f.endsWith(".json") && !f.startsWith("entries"));

const ABBR = /(?:\b(?:a\.m|p\.m|U\.S|St|Mr|Mrs|Ms|Dr|vs|etc|e\.g|i\.e|No|Jr|Sr))\.$/i;

function sentences(text) {
  const out = [];
  for (const block of text.split(/\n+/)) {
    const parts = block.split(/(?<=[.!?:;])\s+/);
    let cur = "";
    for (const p of parts) {
      cur = cur ? cur + " " + p : p;
      if (/[:;]$/.test(cur) || ABBR.test(cur)) continue; // keep going
      out.push(cur);
      cur = "";
    }
    if (cur) out.push(cur);
  }
  return out;
}

// Colons and semicolons were kept as continuations above so a long list that
// reads as one sentence counts as one.
function measure(s) {
  const words = s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  const hard = words.filter((w) => w.replace(/[^A-Za-z]/g, "").length >= HARD_LEN);
  return { words: words.length, hard: hard.length, hardList: hard };
}

const isIso = (s) => /^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(s);
const isUrl = (s) => /^(https?:\/\/|mailto:|tel:|\/|#)/.test(s) || /^[\w.-]+\.(org|com|gov|edu)(\/\S*)?$/.test(s);
const isId = (s) => /^[a-z0-9]+(-[a-z0-9]+)+$/.test(s);

function* walk(node, p) {
  if (typeof node === "string") yield [p, node];
  else if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) yield* walk(node[i], `${p}[${i}]`);
  }
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (SKIP_KEYS.has(k)) continue;
      yield* walk(v, p ? `${p}.${k}` : k);
    }
  }
}

function collect() {
  const found = []; // {key, file, path, sentence, words, hard, why}
  const check = (file, jpath, text, idForKey) => {
    if (isIso(text) || isUrl(text) || (isId(text) && !/\s/.test(text))) return;
    for (const s of sentences(text)) {
      const m = measure(s);
      const why = [];
      if (m.words > MAX_WORDS) why.push(`${m.words} words`);
      if (m.hard > MAX_HARD) why.push(`${m.hard} hard words (${m.hardList.join(", ")})`);
      if (why.length) found.push({ key: `${file}:${idForKey || jpath}`, file, path: jpath, sentence: s, why: why.join("; ") });
    }
  };
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(root, "data", f), "utf8"));
    for (const [p, t] of walk(data, "")) check(f, p, t);
  }
  const entries = JSON.parse(fs.readFileSync(path.join(root, "data", "entries.json"), "utf8"));
  for (const e of entries) {
    for (const fld of ENTRY_FIELDS) {
      if (typeof e[fld] === "string") check("entries.json", `${e.id}.${fld}`, e[fld], `${e.id}.${fld}`);
    }
  }
  return found;
}

// KNOWN: "file:json path or card id.field" -> reason. Must shrink over time.
const KNOWN = {

};

test("data prose: sentence length and hard-word ceiling", () => {
  const t0 = Date.now();
  const found = collect();
  const keys = new Set(found.map((f) => f.key));
  const fresh = found.filter((f) => !(f.key in KNOWN));
  const msg = fresh.map((f) => `${f.file} ${f.path}: ${f.why}\n    ${f.sentence}`).join("\n");
  assert.equal(fresh.length, 0, `New long or hard sentences (fix the text or list it in KNOWN with a reason):\n${msg}`);
  const stale = Object.keys(KNOWN).filter((k) => !keys.has(k));
  assert.deepEqual(stale, [], `These KNOWN items now pass; remove them from KNOWN:\n${stale.join("\n")}`);
  assert.ok(Date.now() - t0 < 10000, "must run in under 10 seconds");
});

test("data prose: the checker sees text and catches long or hard sentences", () => {
  let n = 0;
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "data", f), "utf8"));
    for (const _ of walk(d, "")) n++;
  }
  assert.ok(n > 1000, `expected many strings, saw ${n}`);
  assert.ok(measure(Array(61).fill("word").join(" ")).words > MAX_WORDS);
  const hard = Array(7).fill("extraordinarily").join(" ");
  assert.ok(measure(hard).hard > MAX_HARD);
  assert.equal(sentences("Come early. Bring ID. Ask for Sam.").length, 3);
});
