// Youth leaders page accuracy (ticket r3-accuracy-5).
// The survey says "other than their parents", not "outside their family" (relatives count as other adults).
// The 24 teen sample plan must say it is more than the 12 to 15 MENTOR cap.
// Run with: node --test tests/r3-accuracy-5.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SOURCES = ["src/leaders.html", "leaders.html"];
const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

for (const file of SOURCES) {
  test(`${file}: lede says "other than their parents" and not "outside their family"`, () => {
    const html = read(file);
    assert.ok(html.includes("other than their parents"), `${file} is missing the corrected wording`);
    assert.ok(!html.includes("outside their family"), `${file} still says "outside their family"`);
  });

  test(`${file}: the 24 teen sample plan says it is more than the 12 to 15 cap`, () => {
    const html = read(file);
    assert.ok(html.includes("12 to 15"), `${file} no longer quotes the 12 to 15 cap`);
    const paragraphs = html.match(/<p[^>]*>[\s\S]*?<\/p>/g) || [];
    const plan = paragraphs.find((p) => p.includes("24 teens"));
    assert.ok(plan, `${file} has no paragraph with the 24 teen sample plan`);
    assert.ok(plan.includes("more than the 12 to 15"), `${file}: the 24 teen paragraph does not flag the cap`);
  });
}

// Languages page gap wording (ticket r3-accuracy-5, languages.json).
// The Social Security gap must not say the SSA pages were unreadable, because Get ready quotes that page.
const LANG_TEXT = read("data/languages.json");
const LANG = JSON.parse(LANG_TEXT);

test("languages.json: no gap says Social Security pages could not be read", () => {
  for (const gap of LANG.gaps) {
    if (/Social Security/.test(gap)) {
      assert.ok(!/pages could not be read/.test(gap), `gap still says pages could not be read: ${gap}`);
    }
  }
  assert.ok(!LANG_TEXT.includes("pages could not be read"), "languages.json still has 'pages could not be read'");
});

test("languages.json: the Social Security gap uses the reworded line", () => {
  const want = "We found no Social Security Administration page in these languages that we could read, so none is listed. The English card page is on the Get ready page.";
  assert.ok(LANG.gaps.includes(want), "reworded Social Security gap line is missing");
});

test("languages.json: no Social Security link is added to the languages list", () => {
  assert.ok(!/ssa\.gov/.test(LANG_TEXT), "languages.json must not link to ssa.gov");
});

test("ready.html still links ssa.gov/number-card/replace-card", () => {
  assert.ok(read("src/ready.html").includes("ssa.gov/number-card/replace-card"), "src/ready.html lost the SSA replace-card link");
});
