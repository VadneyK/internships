// Round 2 data content 6: a closed card must not carry a past deadline_iso.
// Same rule as the 2026-10-09 cards: deadline_iso is null, deadline_text keeps the dates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entries = JSON.parse(readFileSync(join(root, 'data', 'entries.json'), 'utf8'));
const list = Array.isArray(entries) ? entries : (entries.entries || entries.programs || []);

test('no closed-expect-reopen card has a deadline_iso before 2026-10-10', () => {
  const stale = list
    .filter(e => e.status === 'closed-expect-reopen' && e.deadline_iso && e.deadline_iso < '2026-10-10')
    .map(e => e.id);
  assert.deepEqual(stale, []);
});

test('the three cleared cards keep their dates in deadline_text', () => {
  for (const id of ['davis-teen-leadership-council', 'sf-girls-on-the-run-junior-coach', 'us-senate-youth-program']) {
    const e = list.find(x => x.id === id);
    assert.ok(e, id + ' is in entries.json');
    assert.equal(e.deadline_iso, null, id);
    assert.ok(e.deadline_text && /20\d\d/.test(e.deadline_text), id + ' keeps deadline_text');
  }
});
