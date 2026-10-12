// Rules page: the California break bullet names its source and softens the flat guarantee (ticket r3-accuracy-6).
// Run with: node --test tests/r3-accuracy-6.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const LINE_START = "<b>Breaks:</b> the page says you get a 30-minute meal break (unpaid) if you work more than 5 hours (as stated in the Labor Commissioner Youth Advocate brochure, read Oct 10, 2026).";

for (const page of ["src/rules.html", "rules.html"]) {
  test(`${page} names the break source and the read date`, () => {
    const html = read(page);
    assert.ok(html.includes(LINE_START), `${page} is missing the sourced break sentence`);
    assert.ok(html.includes("You can waive that meal break if you only work 6 hours."), `${page} is missing the 6 hour waiver`);
    assert.ok(html.includes("(as stated in the DIR minors summary charts, read Oct 10, 2026)"), `${page} is missing the day of rest source`);
    assert.equal(html.includes("if you work more than 5 hours you get a 30-minute meal break"), false, `${page} still states the meal break as a flat guarantee`);
    assert.equal(html.includes("You also get a day of rest in seven."), false, `${page} still states the day of rest as a flat guarantee`);
  });
}
