// Ticket sec-csp: every built page carries a Content-Security-Policy meta tag, first in <head>, with the expected
// directives, and its script-src hashes match the page's inline scripts exactly. Plain file reads and jsdom parsing,
// no page script runs. Run with: node --test tests/r9-tests-1-csp-meta.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
const sha = (s) => "'sha256-" + crypto.createHash("sha256").update(s, "utf8").digest("base64") + "'";

// frame-ancestors, report-uri and sandbox are ignored in a meta tag, so they must not be listed there.
const EXPECTED = {
  "default-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:"],
  "font-src": ["'self'"],
  "connect-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
};

function parsePolicy(text) {
  const out = {};
  for (const part of text.split(";").map((s) => s.trim()).filter(Boolean)) {
    const [name, ...vals] = part.split(/\s+/);
    assert.ok(!(name in out), "directive listed twice: " + name);
    out[name] = vals;
  }
  return out;
}

test("there are built pages to check", () => {
  assert.ok(PAGES.length >= 20, "found " + PAGES.length + " root pages");
});

for (const file of PAGES) {
  test(`${file}: CSP meta is first in head with the expected directives`, () => {
    const doc = new JSDOM(fs.readFileSync(path.join(ROOT, file), "utf8")).window.document;
    const metas = doc.querySelectorAll('meta[http-equiv="Content-Security-Policy" i]');
    assert.equal(metas.length, 1, "exactly one CSP meta tag");
    assert.equal(doc.head.firstElementChild, metas[0], "the CSP meta is the first element in <head>");
    const policy = parsePolicy(metas[0].getAttribute("content"));
    for (const [name, vals] of Object.entries(EXPECTED)) assert.deepEqual(policy[name], vals, name);
    for (const bad of ["frame-ancestors", "report-uri", "report-to", "sandbox"]) assert.ok(!(bad in policy), bad + " is ignored in a meta tag");
    // The policy has no other directive than the ones listed here plus script-src.
    assert.deepEqual(Object.keys(policy).sort(), [...Object.keys(EXPECTED), "script-src"].sort());
    for (const v of Object.values(policy).flat()) assert.ok(!/\*|unsafe-eval|unsafe-hashes|https?:/.test(v), "no wildcard, eval, hash-attr or outside host: " + v);
    assert.ok(!policy["script-src"].includes("'unsafe-inline'"), "script-src has no unsafe-inline");
  });

  test(`${file}: <meta charset> is inside the first 1024 bytes`, () => {
    const buf = fs.readFileSync(path.join(ROOT, file));
    const at = buf.indexOf("<meta charset");
    assert.ok(at >= 0, "page has <meta charset");
    assert.ok(at < 1024, "<meta charset is at byte " + at + ", must be below 1024");
  });

  test(`${file}: script-src hashes match the inline scripts exactly`, () => {
    const doc = new JSDOM(fs.readFileSync(path.join(ROOT, file), "utf8")).window.document;
    const policy = parsePolicy(doc.querySelector('meta[http-equiv="Content-Security-Policy" i]').getAttribute("content"));
    const [self, ...hashes] = policy["script-src"];
    assert.equal(self, "'self'");
    const inline = [...doc.querySelectorAll("script:not([src])")].map((s) => sha(s.textContent));
    assert.ok(inline.length >= 1, "the theme script is inline on every page");
    assert.deepEqual([...new Set(inline)].sort(), [...hashes].sort(), "one hash per distinct inline script, no extras");
    for (const h of hashes) assert.match(h, /^'sha256-[A-Za-z0-9+/]{43}='$/);
  });

  test(`${file}: no inline event handler attribute, no javascript: link`, () => {
    const doc = new JSDOM(fs.readFileSync(path.join(ROOT, file), "utf8")).window.document;
    for (const el of doc.querySelectorAll("*")) {
      for (const a of el.attributes) {
        assert.ok(!/^on/i.test(a.name), `<${el.localName}> has ${a.name}, which the policy blocks`);
        if (["href", "src", "action", "formaction"].includes(a.name)) assert.ok(!/^\s*javascript:/i.test(a.value), "javascript: URL");
      }
    }
  });
}

test("the layout template and the build both carry the policy", () => {
  const layout = fs.readFileSync(path.join(ROOT, "src/_layout.html"), "utf8");
  assert.ok(layout.indexOf('http-equiv="Content-Security-Policy"') < layout.indexOf('charset="utf-8"'), "CSP meta comes first");
  assert.ok(layout.includes("{{script_hashes}}"), "hashes are filled in by tools/build.py");
});
