// Social Security and Medicare wording and the under-18 permit exception (ticket r2-accuracy-5).
// Run with: node --test tests/r2-accuracy-5.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const GRAD = "unless you have graduated high school or have a certificate of proficiency";

for (const page of ["ready.html", "paycheck.html"]) {
  test(`${page} does not say Social Security and Medicare apply everywhere`, () => {
    const html = read(page);
    assert.equal(html.includes("apply everywhere"), false);
    assert.equal(/Social Security[^<"]{0,80}apply everywhere/.test(html), false);
  });
}

test("paycheck.html names the parent's unincorporated business exception", () => {
  assert.ok(read("paycheck.html").includes("parent's own unincorporated business when you are under 18"));
});

for (const page of ["rules.html", "ready.html"]) {
  test(`${page} gives the graduate and certificate of proficiency exception next to the permit rule`, () => {
    assert.ok(read(page).includes(GRAD), `${page} is missing the graduate exception`);
  });
}

test("permits.json ca.kinds.job.text says graduates and certificate holders do not need one", () => {
  const permits = JSON.parse(read("data/permits.json"));
  assert.ok(permits.states.ca.kinds.job.text.includes("Graduates of high school and teens with a certificate of proficiency do not need one."));
});
