// r2-accuracy-1: New York babysitting and working papers wording.
// Checks that the permit data does not state the flat rules, and that the
// permit data and the More states page agree on the farming and caddying exemption.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const permitsRaw = readFileSync(join(root, 'data', 'permits.json'), 'utf8');
const permits = JSON.parse(permitsRaw);
const ny = permits.states.ny;
const srcStates = readFileSync(join(root, 'src', 'states.html'), 'utf8');
const builtStates = readFileSync(join(root, 'states.html'), 'utf8');

const EXEMPT = 'for almost any job in New York. Farming and caddying are exempt.';

test('permits.json has no flat "too young to babysit" ruling', () => {
  assert.equal(permitsRaw.includes('too young to babysit'), false);
});

test('permits.json has no unqualified "for any job in New York"', () => {
  assert.equal(permitsRaw.includes('for any job in New York'), false);
});

test('New York under-14 babysitting text states the DOL rule and the Red Cross conflict', () => {
  const under = ny.kinds.odd.under;
  assert.equal(under.below, 14);
  assert.equal(
    under.text,
    'At 12 or 13, New York DOL says a babysitter must be at least 14, though the Red Cross says most states have no minimum age. Yard work for 12 and 13 year olds is not stated. Ask: 888-469-7365.'
  );
});

test('permits.json minAge note and job text carry the exemption wording', () => {
  assert.ok(ny.minAge.note.includes(EXEMPT), ny.minAge.note);
  assert.ok(ny.kinds.job.text.includes(EXEMPT), ny.kinds.job.text);
});

test('src/states.html and permits.json agree on the exemption wording', () => {
  assert.ok(srcStates.includes(EXEMPT), 'src/states.html missing exemption sentence');
  assert.ok(builtStates.includes(EXEMPT), 'states.html missing exemption sentence');
  assert.ok(srcStates.includes('Farming and caddying are exempt.'));
  assert.ok(ny.kinds.job.text.includes('Farming and caddying are exempt.'));
});
