// r1-accuracy-6: the Red Cross "most states" babysitting claim must name and link its page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(readFileSync(join(root, 'data', f), 'utf8'));
const URL = 'https://www.redcross.org/take-a-class/resources/articles/how-old-do-you-have-to-be-to-babysit';
const OLD = 'most states have no minimum age';

test('old unsourced phrase is gone from data files', () => {
  for (const f of ['younger.json', 'permits.json']) {
    assert.equal(readFileSync(join(root, 'data', f), 'utf8').includes(OLD), false, f);
  }
});

test('younger.json conflict names the page and carries its link', () => {
  const d = read('younger.json');
  const c = d.conflicts.find((x) => x.startsWith('Babysitting:'));
  assert.match(c, /How Old Do You Have to Be to Babysit\?/);
  assert.equal(d.conflictsSource.u, URL);
});

test('permits.json New York babysitting text names the page and carries its link', () => {
  const u = read('permits.json').states.ny.kinds.odd.under;
  assert.match(u.text, /How Old Do You Have to Be to Babysit\?/);
  assert.equal(u.source.u, URL);
});
