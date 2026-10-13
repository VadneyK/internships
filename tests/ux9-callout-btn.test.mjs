import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../assets/css/style.css', import.meta.url), 'utf8');
const sel = '.callout:not(.plain):not(.warn):not(.bad)';

function has(selector, decl) {
  const esc = selector.replace(/[.()]/g, '\\$&');
  return new RegExp(esc + '\\s*\\{[^}]*' + decl.replace(/[().-]/g, '\\$&')).test(css);
}

test('alt button in the yellow callout uses --ink, also on hover', () => {
  assert.ok(has(sel + ' a.btn.alt', 'color: var(--ink)'));
  assert.ok(has(sel + ' a.btn.alt:hover', 'color: var(--ink)'));
});

test('dark button in the yellow callout uses its button text token, also on hover', () => {
  assert.ok(has(sel + ' a.btn.dark', 'color: var(--tag-fg)'));
  assert.ok(has(sel + ' a.btn.dark:hover', 'color: var(--tag-fg)'));
});

// Rendered-contrast and cascade checks (ux9 review): a regex on the selector alone can pass while the cascade or the tokens fail.
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
function tokens(header) {
  const at = css.indexOf(header);
  assert.ok(at >= 0, header + ' block exists');
  const body = css.slice(at, css.indexOf('}', at));
  const out = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
}
const light = tokens(':root {');
const dark = { ...light, ...tokens(':root[data-theme="dark"]') };

test('yellow callout buttons keep 4.5:1 text contrast in light and dark mode', () => {
  for (const [mode, t] of [['light', light], ['dark', dark]]) {
    assert.ok(t['--yellow'] && t['--ink'] && t['--tag-fg'] && t['--tag-bg'], mode + ' tokens resolved');
    assert.ok(ratio(t['--tag-fg'], t['--tag-bg']) >= 4.5, mode + ' dark button: --tag-fg on --tag-bg');
  }
  assert.ok(ratio(light['--ink'], light['--yellow']) >= 4.5, 'light alt button: --ink on --yellow');
  assert.ok(ratio('#151515', dark['--yellow']) >= 4.5, 'callout text stays dark on yellow in dark mode');
});

test('no higher-specificity link colour rule overrides the callout button colours', () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const spec = (s) => (s.match(/\.[\w-]+|:not\(\.[\w-]+\)|:hover|:focus-visible|\[[^\]]+\]/g) || []).length * 10
    + (/(^|[\s>+~])a\b/.test(s) ? 1 : 0);
  const ourSpec = spec(sel + ' a.btn.alt');
  let checked = 0;
  for (const m of bare.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    if (!/(^|[;\s])color\s*:/.test(m[2])) continue;
    for (const s of m[1].split(',').map((x) => x.trim())) {
      if (!/(^|[\s>+~])a\b/.test(s) || s.startsWith(sel + ' a.btn.')) continue;
      checked++;
      assert.ok(spec(s) < ourSpec, 'rule overrides callout button colour: ' + s);
    }
  }
  assert.ok(checked > 0);
});
