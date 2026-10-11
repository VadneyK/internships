// Windows High Contrast: chart fills, legend keys and the progress meter
// must keep a visible difference when forced colors are active.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'assets', 'css', 'style.css'), 'utf8');

// Return the body of the first @media (forced-colors: active) block, using brace matching.
function forcedColorsBlock(source) {
  const head = '@media (forced-colors: active)';
  const start = source.indexOf(head);
  assert.notEqual(start, -1, 'forced-colors media block is missing');
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return { body: source.slice(open + 1, i), start, end: i + 1 };
    }
  }
  assert.fail('forced-colors media block is not closed');
}

// Return the declaration text for a selector inside the block (exact selector match).
function ruleFor(block, selector) {
  const re = new RegExp('(^|\\})\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  let m;
  let found = null;
  while ((m = re.exec(block))) found = m[2];
  return found;
}

const SYSTEM_KEYWORDS = ['Canvas', 'CanvasText', 'Highlight', 'HighlightText', 'GrayText', 'ButtonFace', 'ButtonText', 'LinkText', 'VisitedText', 'Field', 'FieldText', 'Mark', 'MarkText', 'AccentColor', 'AccentColorText', 'SelectedItem', 'SelectedItemText', 'ActiveText', 'ButtonBorder', 'CanvasText'];

// Comments are stripped so the selector parsing below sees only rules.
const block = forcedColorsBlock(css).body.replace(/\/\*[\s\S]*?\*\//g, '');

test('forced-colors block sets forced-color-adjust none on fills, keys and meter', () => {
  for (const sel of ['.k1', '.k2', '.k3', '.bar.h', '.bar.a', '.meter > i']) {
    const decl = ruleFor(block, sel);
    assert.ok(decl, `${sel} has no rule inside the forced-colors block`);
    assert.match(decl, /forced-color-adjust:\s*none/, `${sel} must set forced-color-adjust: none`);
  }
});

test('forced-colors fills use system color keywords only', () => {
  for (const sel of ['.k1', '.k2', '.k3', '.bar.h', '.bar.a', '.meter > i']) {
    const decl = ruleFor(block, sel);
    const keywords = decl.match(/\b[A-Z][A-Za-z]+\b/g) || [];
    const used = keywords.filter((k) => SYSTEM_KEYWORDS.includes(k));
    assert.ok(used.length > 0, `${sel} uses no system color keyword`);
  }
});

test('forced-colors block has no hex or rgb color values', () => {
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b/, 'hex color found in forced-colors block');
  assert.doesNotMatch(block, /\brgba?\(/i, 'rgb color found in forced-colors block');
  assert.doesNotMatch(block, /\bhsla?\(/i, 'hsl color found in forced-colors block');
});

test('legend keys k1, k2 and k3 map to three distinct treatments', () => {
  const k1 = ruleFor(block, '.k1');
  const k2 = ruleFor(block, '.k2');
  const k3 = ruleFor(block, '.k3');
  const bg = (decl) => (decl.match(/background(?:-color|-image)?:\s*([^;]+);/) || [])[1]?.trim();
  const values = [bg(k1), bg(k2), bg(k3)];
  assert.ok(values.every(Boolean), 'each legend key needs a background');
  assert.equal(new Set(values).size, 3, `legend keys are not distinct: ${values.join(' | ')}`);
  const isPattern = /gradient\(/.test(values[2]);
  const keywordOf = (v) => v.match(/\b[A-Z][A-Za-z]+\b/)?.[0];
  if (!isPattern) {
    assert.notEqual(keywordOf(values[0]), keywordOf(values[1]));
    assert.notEqual(keywordOf(values[1]), keywordOf(values[2]));
  }
});

test('forced-colors block does not contain rules outside the media query', () => {
  // The block must be self-contained: nothing after its closing brace belongs to it,
  // and every selector inside it is one we expect to override.
  const allowed = ['.chip[aria-pressed="true"]', '.tile[aria-pressed="true"]', '.star[aria-pressed="true"]', ':focus-visible', '.k1', '.k2', '.k3', '.bar.h', '.bar.a', '.meter > i', '.meter.over > i'];
  const selectors = [...block.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim());
  for (const s of selectors) {
    assert.ok(allowed.includes(s), `unexpected selector inside forced-colors block: ${s}`);
  }
});
