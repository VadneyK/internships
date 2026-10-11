// Work permit quick answer on rules.html must not say running your own business needs no permit
// without the chart caveat (ticket r1-accuracy-2).
// Run with: node --test tests/rev-accuracy-2-rules-quick-answer-own-business.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const OLD = "or running your own small business, does not need one";
const NEW = "A babysitting or yard-work job for neighbors does not need one. For newspaper routes, unpaid volunteering at a nonprofit, or other work you run yourself, ask the Labor Commissioner at 833-526-4636.";

for (const rel of ["src/rules.html", "rules.html"]) {
  test(`${rel}: old own-business claim is gone`, () => {
    const html = fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
    assert.equal(html.includes(OLD), false);
  });

  test(`${rel}: new quick answer with the Labor Commissioner number is present`, () => {
    const html = fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
    assert.ok(html.includes(NEW), "new sentence found");
    assert.ok(html.includes("833-526-4636"));
  });

  test(`${rel}: no-permit list keeps the cited volunteering wording`, () => {
    const html = fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
    assert.ok(html.includes("True unpaid volunteering, with parent permission on file with your school (California regulation 5 CCR 10121)"));
    assert.equal(html.includes("generally does not either"), false);
  });
}
