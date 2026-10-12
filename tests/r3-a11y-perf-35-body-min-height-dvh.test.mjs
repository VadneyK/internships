// r3-a11y-perf-35: the body rule sets min-height to 100vh and then 100dvh, so phones with the browser bars hidden
// get the real screen height and older browsers keep 100vh. Any other rule in style.css that sets height or
// min-height to 100vh (outside @media print) must also have a 100dvh line after it in the same block.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../assets/css/style.css", import.meta.url), "utf8");

// Returns [start, end) ranges of every @media print block, found by brace matching.
function printRanges(text) {
  const ranges = [];
  const re = /@media\s+print\s*\{/g;
  let m;
  while ((m = re.exec(text))) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    ranges.push([m.index, i + 1]);
  }
  return ranges;
}

// Returns the body text of the first top-level rule whose selector is exactly "body".
function bodyRule(text) {
  const m = /(^|\n)body\s*\{([^}]*)\}/.exec(text);
  return m ? m[2] : null;
}

test("the body rule sets min-height 100vh, then min-height 100dvh later in the same rule", () => {
  const rule = bodyRule(css);
  assert.ok(rule !== null, "style.css has a body rule");
  const vh = rule.indexOf("min-height: 100vh");
  const dvh = rule.indexOf("min-height: 100dvh");
  assert.ok(vh !== -1, "body rule keeps min-height: 100vh for older browsers");
  assert.ok(dvh !== -1, "body rule has min-height: 100dvh");
  assert.ok(vh < dvh, "100vh must come before 100dvh so browsers without dvh keep 100vh");
});

test("every other height or min-height set to 100vh outside @media print has a 100dvh line after it in the same block", () => {
  const print = printRanges(css);
  const inPrint = (i) => print.some(([s, e]) => i >= s && i < e);
  const re = /(min-)?height:\s*100vh/g;
  const bad = [];
  let m;
  let checked = 0;
  while ((m = re.exec(css))) {
    if (inPrint(m.index)) continue;
    checked++;
    const close = css.indexOf("}", m.index);
    const tail = css.slice(m.index, close === -1 ? css.length : close);
    if (!/(min-)?height:\s*100dvh/.test(tail)) {
      bad.push(css.slice(Math.max(0, m.index - 40), m.index + m[0].length));
    }
  }
  assert.ok(checked >= 1, "expected at least the body rule to set 100vh");
  assert.deepEqual(bad, [], "100vh set with no 100dvh line after it in the same block");
});
