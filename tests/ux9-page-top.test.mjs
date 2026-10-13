// ux9-page-top: pickers first, notes after, one spacing rule.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
const at = (h, s) => { const i = h.indexOf(s); assert.ok(i >= 0, s + " present"); return i; };

test("jobs: picker before jobsNote and Words box, which sit by the results help", () => {
  const h = read("src/jobs.html");
  assert.ok(at(h, 'id="jAge"') < at(h, 'id="jobsNote"'));
  assert.ok(at(h, 'id="jHelp"') < at(h, 'id="jobsNote"'));
  assert.ok(at(h, 'id="jobsNote"') < at(h, 'id="words"'));
});
test("permit: notes after pickers, disclaimer above the answer", () => {
  const h = read("src/permit.html");
  const d = at(h, "This is a summary, not legal advice");
  assert.ok(at(h, 'id="pKind"') < d);
  assert.ok(d < at(h, "Most pages last read"));
  assert.ok(at(h, "Most pages last read") < at(h, 'id="words"'));
  assert.ok(at(h, 'id="words"') < at(h, 'id="pOut"'));
});
test("no repeated inline top-note styles on calendar, jobs, permit, paycheck", () => {
  for (const f of ["calendar", "jobs", "permit", "paycheck"]) {
    assert.doesNotMatch(read("src/" + f + ".html"), /margin-top:1rem;max-width:52rem/, f);
  }
  assert.match(read("assets/css/style.css"), /\.notes > \*, \.topnote \{ max-width: 52rem; margin-top: 1rem; \}/);
});
test("every restyled note carries topnote or sits inside .notes, in src and in the built root html", () => {
  const want = { calendar: ['id="calNote"', 'id="calLegend"'], jobs: ['id="jobsNote"', 'id="words"'], permit: ['id="words"', "This is a summary, not legal advice"], paycheck: ["Facts, not tax advice."] };
  for (const [f, marks] of Object.entries(want)) {
    for (const h of [read("src/" + f + ".html"), read(f + ".html")]) {
      const nStart = h.indexOf('<div class="notes">');
      const nEnd = nStart < 0 ? -1 : h.indexOf("\n    </div>\n", nStart);
      for (const m of marks) {
        const i = at(h, m);
        // the opening tag of the box that holds the marker (or the marker's own tag)
        const tagStart = Math.max(h.lastIndexOf('<div class="callout', i + 1), h.lastIndexOf("<details", i + 1), h.lastIndexOf("<p", i + 1) < 0 ? -1 : -1);
        const tag = h.slice(tagStart, h.indexOf(">", tagStart) + 1);
        const topnote = /class="[^"]*\btopnote\b/.test(tag);
        const inNotes = nStart >= 0 && i > nStart && i < nEnd;
        assert.ok(topnote || inNotes, f + ": " + m + " needs topnote or .notes (" + tag + ")");
      }
    }
  }
});
