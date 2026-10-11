// Parent business exception matches its IRS source (ticket r2-accuracy-2b).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const SENTENCE = "The exception is working for your parent's own sole proprietorship, or a partnership where both partners are your parents, when you are under 18. It does not apply to a corporation";

for (const page of ["paycheck.html", "ready.html"]) {
  test(`${page} says what the IRS page says about a parent's business`, () => {
    assert.ok(read(page).includes(SENTENCE));
  });
}

test("paycheck checkbox names the sole proprietorship and parent partnership", () => {
  assert.ok(read("paycheck.html").includes("I work for my parent's own business (a sole proprietorship, or a partnership where both partners are my parents) and I am under 18"));
});

test("no src page says unincorporated business without sole proprietorship", () => {
  for (const f of fs.readdirSync(new URL("../src/", import.meta.url)).filter((x) => x.endsWith(".html"))) {
    const html = read(`src/${f}`);
    for (const m of html.matchAll(/unincorporated business/gi)) {
      assert.ok(/sole proprietorship/i.test(html.slice(m.index, m.index + 120)), `${f} has unincorporated business alone`);
    }
  }
});
