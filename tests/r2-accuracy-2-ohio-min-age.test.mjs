// r2-accuracy-2: Ohio minimum-age note must not contradict the job answer.
// For any state whose job answer is "no permit" or says "but none" (summer
// exemption), the minimum-age note must not claim every minor needs a permit
// or that a permit covers any job.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const permits = JSON.parse(readFileSync(join(root, 'data', 'permits.json'), 'utf8'));

test('Ohio minAge note states the ages 14 and 15 permit and the 16 and 17 summer exemption', () => {
  const note = permits.states.oh.minAge.note;
  assert.ok(note.startsWith('Ages 14 and 15 need a working permit.'), note);
  assert.ok(note.includes('Ages 16 and 17 need one during the school year, but none for nonagricultural, nonhazardous summer-vacation work.'), note);
});

test('states whose job answer has no permit or an exemption do not say "Every minor" or "any job" in minAge.note', () => {
  const checked = [];
  for (const [id, s] of Object.entries(permits.states)) {
    const jobText = (s.kinds && s.kinds.job && s.kinds.job.text) || '';
    const noPermit = s.kinds.job.permit === null || jobText.includes('but none');
    if (!noPermit) continue;
    checked.push(id);
    const note = s.minAge.note;
    assert.equal(note.includes('Every minor'), false, `${id} minAge.note says "Every minor": ${note}`);
    assert.equal(note.includes('any job'), false, `${id} minAge.note says "any job": ${note}`);
  }
  assert.ok(checked.includes('oh'), 'Ohio is checked by this rule');
});
