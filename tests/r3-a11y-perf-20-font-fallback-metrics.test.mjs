import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const fonts = read('assets/css/fonts.css');
const style = read('assets/css/style.css');

const faces = [...fonts.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
const family = (b) => (b.match(/font-family:\s*'([^']+)'/) || [])[1];
const byFamily = (n) => faces.filter((b) => family(b) === n);

test('each fallback face is local and has all four metric overrides', () => {
  for (const n of ['Archivo Fallback', 'DM Sans Fallback', 'Permanent Marker Fallback']) {
    const f = byFamily(n);
    assert.equal(f.length, 1, n);
    assert.match(f[0], /src:\s*local\(/, n);
    assert.doesNotMatch(f[0], /url\(/, n);
    for (const k of ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override']) {
      assert.match(f[0], new RegExp(k + ':\\s*[\\d.]+%'), n + ' ' + k);
    }
  }
  assert.match(fonts, /Method \(fontTools/);
});

test('font stacks list the fallback right after the web family', () => {
  const stack = (v) => style.match(new RegExp('--' + v + ':\\s*([^;]+);'))[1].split(',').map((s) => s.trim().replace(/"/g, ''));
  const want = { display: ['Archivo', 'Archivo Fallback'], body: ['DM Sans', 'DM Sans Fallback'], marker: ['Permanent Marker', 'Permanent Marker Fallback'] };
  for (const [v, [web, fb]] of Object.entries(want)) {
    const s = stack(v);
    assert.deepEqual(s.slice(0, 2), [web, fb], v);
    assert.ok(byFamily(web).length > 0 && byFamily(fb).length === 1, v);
    assert.ok(['sans-serif', 'cursive', 'system-ui'].some((g) => s.indexOf(g) > 1), v);
  }
});

test('no new font files and preload links unchanged', () => {
  const files = readdirSync(path.join(root, 'assets/fonts')).filter((f) => !f.startsWith('.')).sort();
  assert.equal(files.length, 11);
  assert.ok(files.every((f) => f.endsWith('.woff2')));
  const layout = read('src/_layout.html');
  const pre = layout.match(/<link rel="preload"[^>]*>/g);
  assert.deepEqual(pre, [
    '<link rel="preload" href="assets/fonts/archivo-italic-latin.woff2" as="font" type="font/woff2" crossorigin>',
    '<link rel="preload" href="assets/fonts/dm-sans-latin.woff2" as="font" type="font/woff2" crossorigin>',
  ]);
});
