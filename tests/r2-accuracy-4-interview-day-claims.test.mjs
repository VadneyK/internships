// Interview day tips: no flat "at least 10" line, and no minute count is credited to Minnesota.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const data = JSON.parse(read("data/interview.json"));

test("day[0] names the Addison 5 to 10 minute range and no longer says 'at least 10'", () => {
  assert.equal(
    data.day[0],
    "Arrive early. The Addison library guide says 5 to 10 minutes. The Minnesota CareerForce page says to show up on time and to allow enough time to get there."
  );
  assert.doesNotMatch(data.day[0], /at least 10/);
});

test("no day tip attributes a minute count to Minnesota", () => {
  for (const tip of data.day) {
    const sentences = tip.split(/(?<=\.)\s+/);
    for (const s of sentences) {
      if (!/Minnesota/.test(s)) continue;
      assert.doesNotMatch(s, /\d+\s*(minutes?|min\b)/, `minute count credited to Minnesota: ${s}`);
      assert.doesNotMatch(s, /\bat least\s+\d/, `minute count credited to Minnesota: ${s}`);
    }
  }
});

test("day[1] attributes the two copies to Cal Poly Pomona's practice interview", () => {
  assert.equal(
    data.day[1],
    "Bring copies of your resume. Cal Poly Pomona says to bring two copies to a practice interview: one for you and one for them. Bring a pen and a small pad too. Our suggestion, not from a source."
  );
});

test("gaps names the Illinois file name year and the PDF's February 2019 mark, and keeps the 2012 NYC line", () => {
  const gap = data.gaps[5];
  assert.match(gap, /file name says May 2015/);
  assert.match(gap, /PDF is marked February 2019/);
  assert.match(gap, /2012/);
});

test("src/ready.html first-day line uses the Addison range with its existing interview link", () => {
  const html = read("src/ready.html");
  assert.ok(
    html.includes('Arrive a few minutes early. For an interview the Addison library guide says 5 to 10 minutes, see <a href="interview.html">Apply and interview</a>.'),
    "ready.html first-day line"
  );
});
