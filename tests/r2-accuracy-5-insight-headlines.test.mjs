// r2-accuracy-5: Numbers page headlines say only what the studies say, and the Pew card compares like with like.
// Checks both src/insights.html (the template) and insights.html (the built page).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
const FILES = ['src/insights.html', 'insights.html'];

const OLD_HEADINGS = [
  'Keep school-year hours under 20',
  'Work ethic matters most',
  'Referrals are rare and powerful',
  'A summer job pays that year',
];

const NEW_HEADINGS = [
  'Long school-year hours go with worse school results',
  'Employers say work ethic is very important',
  'Referrals are a small share of applications and a bigger share of hires',
  'New York City lottery winners earned more that year',
];

// The Pew card is the article whose heading is "If you do not have a job yet, you are with most teens".
function pewCard(html) {
  const start = html.indexOf('If you do not have a job yet, you are with most teens');
  assert.ok(start >= 0, 'Pew card heading not found');
  const end = html.indexOf('</article>', start);
  assert.ok(end > start, 'Pew card has no closing article tag');
  return html.slice(start, end);
}

for (const file of FILES) {
  test(`${file}: the four overreaching headings are gone`, () => {
    const html = read(file);
    for (const old of OLD_HEADINGS) {
      assert.ok(!html.includes(old), `${file} still has old heading: ${old}`);
    }
  });

  test(`${file}: the four accurate headings are present`, () => {
    const html = read(file);
    for (const heading of NEW_HEADINGS) {
      assert.ok(html.includes(heading), `${file} lacks heading: ${heading}`);
    }
  });

  test(`${file}: the Pew card says the 2026 figure covers June and July only`, () => {
    const card = pewCard(read(file));
    assert.ok(
      card.includes('The 2026 figure covers June and July only. The 2025 and 2000 figures include August, so the comparison is rough.'),
      `${file} Pew card lacks the month-set caveat`
    );
    assert.ok(card.includes('June and July only'), `${file} Pew card lacks "June and July only"`);
  });

  test(`${file}: the Pew card counts teens with a paying job, not "were employed"`, () => {
    const card = pewCard(read(file));
    assert.ok(card.includes('had a paying job for at least part of the summer'), `${file} Pew card lacks the paying-job wording`);
    assert.ok(!card.includes('were employed'), `${file} Pew card still says "were employed"`);
  });

  test(`${file}: no en dash or em dash in the changed page`, () => {
    assert.doesNotMatch(read(file), DASHES);
  });
}
