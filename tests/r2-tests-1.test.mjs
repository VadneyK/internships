// Pages must survive damaged saved data (old saves, half-written saves, a browser extension editing storage).
// Run with: node --test tests/r2-tests-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

const cases = [
  ["playbook.html", "people", ['{"a":1}', "null", "5", '[null,5,"x"]', '[{"n":5,"w":{},"h":[],"s":1,"d":2}]', '[{"n":"A","s":"sent","d":"garbage"}]', '[{"n":"A","s":"sent","d":"2026-02-31"}]']],
  ["playbook.html", "me", ["5", "null", "[1]"]],
  ["leaders.html", "leader", ["null", "5", "[1]"]],
  ["ready.html", "ready", ["null", "5", "[1]"]],
  ["interview.html", "interview", ["null", "5", '{"q":5,"refs":5}']],
  ["resume.html", "resume", ["null", "5", "[1]"]],
  ["index.html", "saved", ["null", "5", '{"a":1}', "[null,5]"]],
  ["find.html", "saved", ["null", "5", '{"a":1}', "[null,5]"]],
];

for (const [file, key, values] of cases) {
  for (const value of values) {
    test(file + " survives " + key + " = " + value, async () => {
      const page = await loadPage(file, { rawStorage: { [key]: value } });
      try {
        assert.deepEqual(page.errors, []);
        const text = page.document.body.textContent;
        assert.ok(!/NaN|undefined|Invalid Date/.test(text), "bad text on page: " + (text.match(/.{0,20}(NaN|undefined|Invalid Date).{0,20}/) || [""])[0]);
        if (file === "playbook.html" && key === "people") {
          assert.ok(page.document.querySelectorAll("#people .person").length >= 5, "person cards should still render");
        }
      } finally {
        page.window.close();
      }
    });
  }
}
