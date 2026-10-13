// Ticket p9-data-fixes: Kansas permit text in plain words; Red Cross in-person class age matches the class page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(readFileSync(join(root, 'data', f), 'utf8'));

test('Kansas keeps its facts, source and quote', () => {
  const ks = read('states-lite.json').states.find((s) => s.id === 'ks');
  assert.equal(ks.url, 'https://www.ksrevisor.gov/statutes/chapters/ch38/038_006_0004.html');
  assert.equal(ks.quote, 'employing children under sixteen (16) years of age');
  assert.match(ks.permit, /under 16/);
  assert.match(ks.permit, /Kansas secondary school/);
  assert.match(ks.permit, /keep it on file/);
  assert.doesNotMatch(ks.permit, /enrolled in or attending/);
});

test('Red Cross in-person class states the class page age and the article difference', () => {
  const t = read('younger.json').train.find((x) => x.t.includes("Babysitter's Training"));
  assert.match(t.d, /ages 11-16/);
  assert.match(t.d, /11 to 15/);
  assert.doesNotMatch(t.d, /depending on which/);
  assert.equal(t.u, 'https://www.redcross.org/take-a-class/babysitting/babysitting-child-care-training/babysitting-classes');
});

test('no em or en dash in the two edited fields', () => {
  const ks = read('states-lite.json').states.find((s) => s.id === 'ks');
  const t = read('younger.json').train.find((x) => x.t.includes("Babysitter's Training"));
  assert.doesNotMatch(ks.permit + t.d, /[\u2013\u2014]/);
});
