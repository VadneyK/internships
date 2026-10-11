// Shape rules for every data file except data/programs: no blank text, no empty lists, no duplicate ids,
// no stray whitespace, no http: links. A bad leaf here shows up as a blank row on a live page.
// Plain node, no network. Failures print the JSON path.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["money", "younger", "parents", "interview", "languages", "safety", "transit", "calendar", "permits", "gaps", "meta"];

// Allowed exceptions. Each entry is { file, rule, path, why }. In a path, [*] matches any array index and .* matches any one key.
// null on purpose means "no value applies" (no permit needed, no limit, no open date). Data is not edited by this ticket.
const KNOWN = [
  { file: "money", rule: "empty-array", path: "$.presets[*].extra", why: "presets with no extra lines use an empty list" },
  { file: "younger", rule: "null", path: "$.rows[*].cells.*.s", why: "null means no source line for that state cell" },
  { file: "safety", rule: "blank", path: "$.hotlines[*].numbers[*].label", why: "an empty label means the number needs no label" },
  { file: "calendar", rule: "null", path: "$.items[*].opens", why: "null means no fixed open date" },
  { file: "calendar", rule: "null", path: "$.items[*].closes", why: "null means no fixed close date" },
  { file: "permits", rule: "null", path: "$.states.*.kinds.*.permit", why: "null means no permit is needed" },
  { file: "permits", rule: "null", path: "$.states.*.kinds.*.under.permit", why: "null means no permit is needed" },
  { file: "permits", rule: "null", path: "$.states.*.limits.*", why: "null means no limit for that age" },
  { file: "permits", rule: "null", path: "$.states.*.limits.*.*", why: "null means no limit for that field" },
  { file: "gaps", rule: "empty-array", path: "$[*].hubs", why: "a gap with no hubs listed uses an empty list" },
];
const toRe = (pat) => new RegExp("^" + pat.replace(/[$.[\]]/g, "\\$&").replace(/\\\[\*\\\]/g, "\\[\\d+\\]").replace(/\\\.\*/g, "\\.[^.\\[]+") + "$");
const KNOWN_RE = KNOWN.map((k) => ({ ...k, re: toRe(k.path), hits: 0 }));
function isKnown(file, rule, p) {
  let hit = false;
  for (const k of KNOWN_RE) if (k.file === file && k.rule === rule && k.re.test(p)) { k.hits++; hit = true; }
  return hit;
}

const ID_KEYS = ["id", "key", "name"];
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

function walk(file, node, p, out) {
  const at = file + ":" + p;
  if (node === null || node === undefined) {
    out.push(["null", at]);
    return;
  }
  if (typeof node === "string") {
    if (node.trim() === "") { out.push(["blank", at]); return; }
    if (node !== node.trim()) out.push(["edge-space", at]);
    if (/ {2}/.test(node)) out.push(["double-space", at]);
    if (/\t/.test(node)) out.push(["tab", at]);
    for (const m of node.match(/\bhttp:\/\/[^\s"'<>)]*/gi) || []) out.push(["http-link", at + " " + m]);
    return;
  }
  if (Array.isArray(node)) {
    if (node.length === 0) { out.push(["empty-array", at]); return; }
    if (node.every(isObj)) {
      for (const k of ID_KEYS) {
        const seen = new Map();
        node.forEach((o, i) => {
          if (typeof o[k] !== "string" && typeof o[k] !== "number") return;
          if (seen.has(o[k])) out.push(["duplicate-" + k, at + "[" + i + "]." + k + " = " + JSON.stringify(o[k]) + " (also [" + seen.get(o[k]) + "])"]);
          else seen.set(o[k], i);
        });
      }
    }
    node.forEach((v, i) => walk(file, v, p + "[" + i + "]", out));
    return;
  }
  if (isObj(node)) {
    for (const [k, v] of Object.entries(node)) walk(file, v, p + "." + k, out);
  }
}

for (const f of FILES) {
  test("data/" + f + ".json has a clean shape", () => {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", f + ".json"), "utf8"));
    const out = [];
    walk(f, data, "$", out);
    const bad = out.filter(([rule, at]) => !isKnown(f, rule, at.slice(f.length + 1).split(" ")[0]));
    assert.equal(bad.length, 0, "\n" + bad.map(([r, a]) => "  " + r + "  " + a).join("\n"));
  });
}

test("every KNOWN exception still matches something (no stale entries)", () => {
  const stale = KNOWN_RE.filter((k) => k.hits === 0).map((k) => k.file + " " + k.rule + " " + k.path);
  assert.deepEqual(stale, []);
});
