import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const want = {
  'ann-arbor-food-gatherers-volunteer': [8, null],
  'madison-childrens-museum-volunteers': [8, null],
  'madison-henry-vilas-zoo-teen-volunteers': [10, 17],
  'ann-arbor-summer-festival-volunteer': [12, null],
  'evanston-aspire-careers-in-healthcare': [17, null],
  'new-brunswick-free-public-library-teen-volunteer': [16, 17],
  'naacp-jmrl-library-internship-scholarship': [null, null],
  'lansing-umh-sparrow-teen-volunteer': [16, 18],
};
for (const [id, [min, max]] of Object.entries(want)) {
  test(`${id} ages match its text`, () => {
    const p = JSON.parse(readFileSync(new URL(`../data/programs/${id}.json`, import.meta.url), 'utf8'));
    assert.equal(p.min_age, min);
    assert.equal(p.max_age, max);
  });
}
