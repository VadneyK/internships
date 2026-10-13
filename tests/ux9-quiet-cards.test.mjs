// Ticket ux9-quiet-cards: quiet card titles, one a.chip rule, states grids without orphans.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const css = readFileSync(new URL('../assets/css/style.css', import.meta.url), 'utf8');
const srcDir = new URL('../src/', import.meta.url);

test('card h3 gets the quiet sentence-case treatment', () => {
  /* Updated: the rule is now scoped away from page-index and page-find (approved look). */
  const m = css.match(/:where\(body:not\(\.page-index,\.page-find\)\) :is\(\.card>h3,\.grid>\.card h3\) \{([^}]*)\}/);
  assert.ok(m, 'rule exists');
  for (const d of ['font-size: 1.15rem', 'text-transform: none', 'font-style: normal', 'font-weight: 800']) {
    assert.ok(m[1].includes(d), d);
  }
});

test('section h2, callout h3 and steps h3 keep their own rules', () => {
  assert.match(css, /\.callout h3 \{ margin-bottom: \.35em; \}/);
  assert.match(css, /\.steps h3 \{[^}]*font-size: 1\.15rem/);
  assert.match(css, /h1, h2, h3, h4 \{[^}]*text-transform: uppercase/);
});

test('a.chip has no underline from one rule, and no src chip has inline style', () => {
  assert.match(css, /a\.chip \{ text-decoration: none; \}/);
  for (const f of readdirSync(srcDir).filter((n) => n.endsWith('.html'))) {
    const html = readFileSync(new URL(f, srcDir), 'utf8');
    for (const tag of html.match(/<a\b[^>]*>/g) || []) {
      if (/\bclass="[^"]*\bchip\b/.test(tag)) assert.ok(!/\bstyle=/.test(tag), f + ': ' + tag);
    }
  }
});

test('.g2x2 exists and the four-card states grids use it', () => {
  assert.match(css, /\.g2x2 \{ grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 26rem\), 1fr\)\); \}/);
  const html = readFileSync(new URL('states.html', srcDir), 'utf8');
  const grids = html.split('<div class="grid').slice(1);
  let four = 0;
  for (const g of grids) {
    const body = g.split('</section>')[0];
    const cards = (body.match(/<article class="card"/g) || []).length;
    const cls = g.slice(0, g.indexOf('"'));
    if (cards === 4) { four++; assert.ok(cls.includes('g2x2'), cls); }
  }
  assert.ok(four >= 3);
});
