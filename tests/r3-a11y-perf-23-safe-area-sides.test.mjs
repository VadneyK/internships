// Phone notch in landscape: page content must stay clear of the left and right safe-area insets.
// Every page sets viewport-fit=cover, so text and buttons can slide under the notch and rounded corners
// when an iPhone is turned sideways. The .wrap container sets the page gutter, so its side padding must
// never drop below the safe-area inset. This test reads style.css (comments stripped, print excluded).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const raw = fs.readFileSync(path.join(ROOT, "assets", "css", "style.css"), "utf8");
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

// Removes every @media print block (brace matched) so print rules, which may zero the gutter, are not checked.
function stripPrint(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const at = text.indexOf("@media print", i);
    if (at < 0) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, at);
    const open = text.indexOf("{", at);
    let depth = 0;
    let j = open;
    for (; j < text.length; j++) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    i = j + 1;
  }
  return out;
}

// Returns [prelude, body, inMedia] for every innermost { ... } rule, in source order.
function rules(text) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    const prelude = m[1].split(";").pop().replace(/\s+/g, " ").trim();
    out.push({ prelude, body: m[2] });
  }
  return out;
}

// Reads the value of a property from a declaration block. Returns the last value set, or null.
function declValue(body, prop) {
  const re = new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`, "gi");
  let last = null;
  let m;
  while ((m = re.exec(body))) last = m[1].trim();
  return last;
}

const live = stripPrint(css);
const all = rules(live);

test("base .wrap sets left and right gutters that never drop below the safe-area inset", () => {
  const base = all.find((r) => r.prelude === ".wrap");
  assert.ok(base, "a plain .wrap rule must exist outside print");
  assert.equal(
    declValue(base.body, "padding-left"),
    "max(1rem, env(safe-area-inset-left, 0px))",
    ".wrap padding-left must be max(1rem, env(safe-area-inset-left))"
  );
  assert.equal(
    declValue(base.body, "padding-right"),
    "max(1rem, env(safe-area-inset-right, 0px))",
    ".wrap padding-right must be max(1rem, env(safe-area-inset-right))"
  );
});

test("the min-width 48rem .wrap rule keeps the 1.5rem gutter inside the safe-area inset", () => {
  const media = [...stripPrint(css).matchAll(/@media \(min-width:\s*48rem\)\s*\{\s*\.wrap\s*\{([^{}]*)\}\s*\}/g)];
  assert.equal(media.length, 1, "exactly one @media (min-width: 48rem) block sets .wrap padding");
  const body = media[0][1];
  assert.equal(
    declValue(body, "padding-left"),
    "max(1.5rem, env(safe-area-inset-left, 0px))",
    "48rem .wrap padding-left must be max(1.5rem, env(safe-area-inset-left))"
  );
  assert.equal(
    declValue(body, "padding-right"),
    "max(1.5rem, env(safe-area-inset-right, 0px))",
    "48rem .wrap padding-right must be max(1.5rem, env(safe-area-inset-right))"
  );
});

test("no later rule resets the side padding of .wrap, .top .wrap or .foot to a plain length", () => {
  const sideProps = ["padding", "padding-inline", "padding-left", "padding-right", "padding-inline-start", "padding-inline-end"];
  // A selector is guarded when its last compound is .wrap or .foot (so ".top .wrap" and ".foot" count, but
  // ".foot .qlinks", a list inside the footer, does not).
  const isGuarded = (s) => {
    const last = s.split(/\s+/).pop();
    return last === ".wrap" || last === ".foot";
  };
  const offenders = [];
  for (const r of all) {
    const selectors = r.prelude.split(",").map((s) => s.trim());
    if (!selectors.some(isGuarded)) continue;
    for (const prop of sideProps) {
      const v = declValue(r.body, prop);
      if (v === null) continue;
      if (!/safe-area-inset-(left|right)/.test(v) && !/^max\(/.test(v)) offenders.push(`${r.prelude} { ${prop}: ${v} }`);
    }
  }
  // The .wrap rules themselves use max() with env(), so they pass. Any other plain-length side padding fails.
  assert.deepEqual(offenders, [], "side padding on .wrap, .top .wrap or .foot must keep the safe-area inset");
});

test("the header and footer inherit the gutter from .wrap (no side padding of their own)", () => {
  const top = all.filter((r) => r.prelude === ".top .wrap");
  for (const r of top) {
    for (const prop of ["padding", "padding-inline", "padding-left", "padding-right"]) {
      assert.equal(declValue(r.body, prop), null, `.top .wrap must not set ${prop}`);
    }
  }
  const foot = all.filter((r) => r.prelude === ".foot");
  for (const r of foot) {
    for (const prop of ["padding", "padding-inline", "padding-left", "padding-right"]) {
      assert.equal(declValue(r.body, prop), null, `.foot must not set ${prop}`);
    }
  }
});
