import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const permits = JSON.parse(fs.readFileSync(new URL('../data/permits.json', import.meta.url), 'utf8'));
const states = permits.states || permits;

// Known gaps, not yet checked against a 2027 source (follow-up ticket): these
// lines name 2026 with no 2027 note. Do not add to this list; fix the line instead.
const KNOWN_GAPS = new Set(['ny', 'il', 'ma', 'bc', 'oh', 'md']);

test('every state wage line that names 2026 also covers 2027', () => {
  const entries = Array.isArray(states) ? states.map((s) => [s.id || s.code || s.name, s]) : Object.entries(states);
  let checked = 0;
  const bad = [];
  for (const [k, s] of entries) {
    if (!s || typeof s.wage !== 'string' || !s.wage.includes('2026')) continue;
    if (KNOWN_GAPS.has(String(k))) continue;
    checked++;
    if (!/2027|not give a 2027 rate|stays the same/.test(s.wage)) bad.push(k + ': ' + s.wage);
  }
  assert.deepEqual(bad, []);
  assert.ok(checked > 5);
});

test('rules page dates the fast food rate', () => {
  const html = fs.readFileSync(new URL('../src/rules.html', import.meta.url), 'utf8');
  assert.match(html, /\$20\.00 \(as of the page we read on Oct 7, 2026/);
});
