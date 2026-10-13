// ux9-header-footer: jsdom cannot lay out, so check the CSS rules exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../assets/css/style.css', import.meta.url), 'utf8');
const start = css.indexOf('/* ux9-header-footer');
const block = css.slice(start, css.indexOf('/* Jump-link targets', start));

test('ux9 block exists inside a 40rem media query', () => {
  assert.ok(start > 0);
  assert.match(block, /@media \(max-width: 40rem\)/);
});
test('brand and its svg shrink', () => {
  assert.match(block, /\.brand \{[^}]*font-size: clamp\(/);
  assert.match(block, /\.brand svg \{[^}]*clamp\(/);
});
test('open menu is a 2 column grid of bordered links with tap size', () => {
  assert.match(block, /\.top\.menu-js\.open \.nav \{[^}]*grid-template-columns: repeat\(2/);
  assert.match(block, /\.nav a \{[^}]*border-color: var\(--edge\)[^}]*min-height: 2\.75rem/);
  assert.match(block, /aria-current="page"\]/);
});
test('footer quick links are 2 columns and avoid breaks', () => {
  assert.match(block, /\.foot \.qlinks \{[^}]*column-count: 2/);
  assert.match(block, /\.foot \.qlinks li \{[^}]*break-inside: avoid/);
});
test('no em or en dash in block', () => {
  assert.ok(!/[\u2013\u2014]/.test(block));
});
