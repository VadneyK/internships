// r2-tests-1: data/permits.json holds each hour limit twice, as numbers in
// states[st].limits (used by hoursCheck) and as prose in states[st].hours.
// This test checks the two agree. Reads data only, no network, no edits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const permits = JSON.parse(readFileSync(join(root, 'data', 'permits.json'), 'utf8'));

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty'];

// Known mismatches, keyed "state:band:field" (or "state:band:no-numbers").
// Each is a real gap between the checker numbers and the prose, or a null
// band whose prose still has hour numbers. A key that now passes FAILS the
// test, so this list can only shrink. Do not add entries to hide new bugs.
const KNOWN = {
  // limits is null (the checker has no number to use) but the prose gives hour
  // numbers. These are real rules the checker cannot model, so they are known.
  'ca:12:no-numbers': 'CA age 12 row: limits null on purpose, text says the row is for a few jobs and to call the state',
  'mn:16:no-numbers': 'MN 16 and 17: night curfew only, no daily or weekly cap to check',
  'nc:16:no-numbers': 'NC 16 and 17: night curfew only before a school day',
  'oh:16:no-numbers': 'OH 16 and 17: night curfew only before a school day',
  'md:16:no-numbers': 'MD 16 and 17: 12 hours of school plus work and 8 hours off, not a simple day cap',
  'bc:14:no-numbers': 'BC is Canada: hour rules in text, no US style limits in the checker',
};

function hasNumber(text, n) {
  const t = text.toLowerCase();
  if (new RegExp('(?<![\\d:.])' + n + '(?![\\d:])').test(t)) return true;
  const w = WORDS[n];
  return !!w && new RegExp('\\b' + w + '\\b').test(t);
}

function hasClock(text, h24) {
  const t = text.toLowerCase();
  if (h24 === 24 || h24 === 0) {
    return /midnight|\b12(:00)?\s*a\.?m/.test(t);
  }
  if (h24 === 12) return /noon|\b12(:00)?\s*p\.?m/.test(t);
  const h = h24 % 12;
  const suffix = h24 < 12 ? 'a' : 'p';
  return new RegExp('(?<![\\d:])' + h + '(:00)?\\s*' + suffix + '\\.?m').test(t);
}

// "Hour numbers" in prose: a number followed by hours, or a clock time.
function hourNumbersIn(text) {
  const t = text.toLowerCase();
  return /\b\d+\s*(hours?|hrs?)\b/.test(t) || /\d\s*[ap]\.?m\b/.test(t) ||
    /midnight/.test(t) ||
    new RegExp('\\b(' + WORDS.join('|') + ')\\s+hours?\\b').test(t);
}

const NUM_FIELDS = ['schoolDay', 'nonSchoolDay', 'schoolWeek', 'offWeek'];
const CLOCK_FIELDS = ['earliest', 'latest'];

function problems() {
  const out = {};
  for (const [st, s] of Object.entries(permits.states)) {
    const limits = s.limits || {};
    const hours = s.hours || {};
    for (const band of Object.keys(hours)) {
      const text = hours[band];
      const lim = limits[band];
      if (!(band in limits)) continue;
      if (lim === null) {
        if (hourNumbersIn(text)) out[`${st}:${band}:no-numbers`] = text;
        continue;
      }
      for (const f of NUM_FIELDS) {
        if (typeof lim[f] === 'number' && !hasNumber(text, lim[f])) {
          out[`${st}:${band}:${f}`] = `${f}=${lim[f]} not in text`;
        }
      }
      for (const f of CLOCK_FIELDS) {
        if (typeof lim[f] === 'number' && !hasClock(text, lim[f])) {
          out[`${st}:${band}:${f}`] = `${f}=${lim[f]} not a clock time in text`;
        }
      }
    }
  }
  return out;
}

test('permit hour limits agree with their hours text, except known gaps', () => {
  const found = problems();
  if (process.env.R2_DUMP) console.log(JSON.stringify(Object.keys(found), null, 1), found);
  const fresh = Object.keys(found).filter(k => !(k in KNOWN));
  assert.deepEqual(fresh, [], 'New mismatch between limits and hours text:\n' +
    fresh.map(k => `  ${k}: ${found[k]}`).join('\n'));
  const fixed = Object.keys(KNOWN).filter(k => !(k in found));
  assert.deepEqual(fixed, [], 'These known mismatches are fixed, remove them from KNOWN:\n  ' + fixed.join('\n  '));
});

test('checker helpers behave', () => {
  assert.ok(hasNumber('up to 18 hours', 18));
  assert.ok(!hasNumber('up to 48 hours', 8));
  assert.ok(hasNumber('up to three hours', 3));
  assert.ok(hasClock('between 7 a.m. and 7 p.m.', 19));
  assert.ok(hasClock('until midnight', 24));
  assert.ok(!hasClock('7 a.m. to 7 p.m.', 22));
  assert.ok(hourNumbersIn('no more than 4 hours'));
  assert.ok(!hourNumbersIn('Ages 16 and 17 have no limits'));
});
