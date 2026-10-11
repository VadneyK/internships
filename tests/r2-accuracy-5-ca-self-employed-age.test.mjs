// r2-accuracy-5: California newspaper route and self-employed lines must agree on the age of 12.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');

test('permits.json ca.kinds.own says newspaper route needs age 12 or older', () => {
  const permits = JSON.parse(read('data/permits.json'));
  const text = permits.states.ca.kinds.own.text;
  const sentences = text.split(/(?<=\.)\s+/).filter((s) => /newspaper/i.test(s));
  assert.ok(sentences.length >= 1, 'no newspaper sentence in ca.kinds.own');
  for (const s of sentences) assert.match(s, /\b12\b/, `newspaper sentence lacks 12: ${s}`);
  assert.doesNotMatch(text, DASHES);
});

test('younger.json CA cells that mention a newspaper route include 12', () => {
  const data = JSON.parse(read('data/younger.json'));
  const cells = [];
  for (const row of data.rows ?? data.jobs ?? data.grid ?? []) {
    if (row.cells?.ca) cells.push({ job: row.job, t: row.cells.ca.t });
  }
  assert.ok(cells.length > 0, 'no CA cells found in younger.json');
  const news = cells.filter((c) => /newspaper/i.test(c.job) || /newspaper/i.test(c.t));
  assert.ok(news.length >= 2, 'expected CA newspaper and self-employed cells');
  for (const c of news) {
    assert.match(c.t, /\b12\b/, `CA cell lacks 12: ${c.job}: ${c.t}`);
    assert.doesNotMatch(c.t, DASHES);
  }
  const own = cells.find((c) => /self-employed/i.test(c.t));
  assert.ok(own, 'no CA self-employed cell');
  assert.doesNotMatch(own.t, /^Any self-employed minor/);
});

test('src/rules.html and built rules.html mention newspaper routes only with age 12', () => {
  for (const p of ['src/rules.html', 'rules.html']) {
    const html = read(p);
    const lines = html.split('\n').filter((l) => /newspaper/i.test(l) && /(own route|route|delivery)/i.test(l));
    assert.ok(lines.length >= 2, `${p}: expected newspaper lines`);
    for (const l of lines) {
      if (/own route/i.test(l)) assert.match(l, /\b12\b/, `${p} lacks 12: ${l.trim()}`);
    }
    assert.doesNotMatch(html.split('\n').filter((l) => /self-employed minor/i.test(l)).join('\n'), /Any self-employed minor/);
    assert.doesNotMatch(lines.join('\n'), DASHES);
  }
});
