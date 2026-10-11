// r3-accuracy-6: every "1 to 2 days" thank-you line on the Ready and Playbook
// pages must carry a source or the "Our suggestion, not from a source" label.
// Checks the source files under src/ and the built root pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['src/ready.html', 'ready.html', 'src/playbook.html', 'playbook.html'];
const LABEL = 'Our suggestion, not from a source';
const WORKNET = 'apps.illinoisworknet.com';
// Matches the label in either case, since it may open a sentence or follow one.
const LABEL_RE = /our suggestion, not from a source/i;

// Each list item or table row is one "line" for this check.
function lineSegments(html) {
  return html.split(/<li[\s>]/).slice(1).map((s) => s.split('</li>')[0]);
}

for (const rel of files) {
  test(`${rel}: every 1 to 2 day thank-you line has a source link or the label`, () => {
    const html = readFileSync(join(root, rel), 'utf8');
    const hits = lineSegments(html).filter((s) => /1 to 2 days/.test(s) && /thank-you/i.test(s));
    assert.ok(hits.length > 0, `${rel} has no 1 to 2 day thank-you line to check`);
    for (const seg of hits) {
      const sourced = seg.includes(WORKNET) || LABEL_RE.test(seg);
      assert.ok(sourced, `unsourced timing line in ${rel}: ${seg.replace(/<[^>]+>/g, '').trim()}`);
    }
  });
}

test('ready page: after an interview, workNet timing, link to Apply and interview, and the hiring note is labelled', () => {
  const html = readFileSync(join(root, 'src/ready.html'), 'utf8');
  const seg = lineSegments(html).find((s) => /1 to 2 days/.test(s));
  assert.ok(seg, 'ready line with 1 to 2 days is missing');
  assert.match(seg, /After an interview, Illinois workNet says to send a thank-you within 1 to 2 days/);
  assert.match(seg, /href="interview\.html">Apply and interview</);
  assert.match(seg, /A note to the person who hired you is our suggestion, not from a source\./);
});

test('built ready and playbook pages match their source lines', () => {
  for (const rel of ['ready.html', 'playbook.html']) {
    const src = readFileSync(join(root, 'src', rel), 'utf8');
    const built = readFileSync(join(root, rel), 'utf8');
    const srcLines = lineSegments(src).filter((s) => /1 to 2 days/.test(s)).map((s) => s.trim());
    for (const seg of srcLines) {
      assert.ok(built.includes(seg), `${rel} was not rebuilt from src: ${seg.slice(0, 80)}`);
    }
  }
});
