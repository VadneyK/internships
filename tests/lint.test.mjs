// 2026-10-15: every script the site ships passes a bug-class lint (tools/eslint.config.mjs). A one-off pass found
// a function declared twice in permit.js, two re-declared variables, a dead per-card computation in find.js and an
// unused value; all fixed. Run with: node --test tests/lint.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("assets/js has no lint errors (undefined names, re-declarations, dead code, unused values)", async () => {
  const eslint = new ESLint({ cwd: ROOT, overrideConfigFile: path.join(ROOT, "tools/eslint.config.mjs") });
  const results = await eslint.lintFiles(["assets/js/*.js"]);
  assert.ok(results.length >= 20, "it linted the page scripts (" + results.length + " files)");
  const problems = results.flatMap((r) => r.messages.map((m) => path.relative(ROOT, r.filePath) + ":" + m.line + " " + m.ruleId + " " + m.message));
  assert.deepEqual(problems, []);
});
