// Image and QR safety for ticket r3-tests-7.
// Every SVG under assets/ must be free of scripts, foreign objects, event handlers,
// remote links and remote fonts or images, and must declare a viewBox. The share image
// assets/img/og.jpg must match the size its og:image meta tags state and stay small.
// Each QR svg in assets/qr must be used by share.html or a built page.
// Run with: node --test tests/r3-tests-7-image-safety.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, extname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const svgFiles = walk(join(root, "assets"))
  .filter((f) => extname(f).toLowerCase() === ".svg")
  .map((f) => relative(root, f))
  .sort();

// Returns the first matching snippet (trimmed, short) or null.
function firstMatch(text, re) {
  const m = text.match(re);
  if (!m) return null;
  const start = Math.max(0, m.index - 20);
  return text.slice(start, m.index + m[0].length + 40).replace(/\s+/g, " ").trim();
}

test("the asset tree has SVG files to check", () => {
  assert.ok(svgFiles.length >= 10, `expected at least 10 SVG files under assets/, found ${svgFiles.length}`);
});

for (const file of svgFiles) {
  test(`${file} has no script, foreignObject, event handler or remote reference`, () => {
    const text = read(file);
    const checks = [
      ["<script", /<script\b/i, "a <script> element"],
      ["<foreignObject", /<foreignObject\b/i, "a <foreignObject> element"],
      ["on* attribute", /\s on[a-z]+\s*=/i, "an on* event attribute"],
      ["remote href", /\b(?:xlink:)?href\s*=\s*["']\s*(?:https?:)?\/\/[^"']*["']/i, "an external href or xlink:href"],
      ["remote src", /<image\b[^>]*\bsrc\s*=\s*["']\s*(?:https?:)?\/\/[^"']*["']/i, "an <image> with a remote src"],
      ["@import", /@import/i, "an @import rule"],
      ["remote url()", /url\(\s*["']?\s*(?:https?:)?\/\//i, "a url() that points off the site"],
    ];
    for (const [label, re, what] of checks) {
      const hit = firstMatch(text, re);
      assert.equal(hit, null, `${file}: found ${what} (${label}): ...${hit}...`);
    }
  });

  test(`${file} declares a viewBox on the root svg`, () => {
    const text = read(file);
    const root_tag = text.match(/<svg\b[^>]*>/i);
    assert.ok(root_tag, `${file}: no <svg> root element found`);
    assert.match(root_tag[0], /\sviewBox\s*=\s*["'][^"']+["']/i, `${file}: root <svg> has no viewBox: ${root_tag[0].slice(0, 120)}`);
  });
}

// JPEG SOF0, SOF1 or SOF2 marker carries height and width as big-endian 16-bit values.
function jpegSize(buf) {
  assert.ok(buf[0] === 0xff && buf[1] === 0xd8, "og.jpg is not a JPEG (missing SOI marker)");
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker === 0xff) { i += 1; continue; }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error("og.jpg: no SOF marker found");
}

test("og.jpg is the size the og:image meta tags state, and under 300 KB", () => {
  const ogPath = join(root, "assets/img/og.jpg");
  assert.ok(existsSync(ogPath), "assets/img/og.jpg is missing");
  const index = read("index.html");
  const stated = {
    width: Number(index.match(/<meta property="og:image:width" content="(\d+)"/)?.[1]),
    height: Number(index.match(/<meta property="og:image:height" content="(\d+)"/)?.[1]),
  };
  assert.ok(stated.width && stated.height, "index.html has no og:image:width or og:image:height meta tags");
  const buf = readFileSync(ogPath);
  const actual = jpegSize(buf);
  assert.deepEqual(
    { width: actual.width, height: actual.height },
    stated,
    `assets/img/og.jpg is ${actual.width} by ${actual.height} but index.html states ${stated.width} by ${stated.height}`,
  );
  assert.equal(actual.width, 1200, "og.jpg width should be 1200");
  assert.equal(actual.height, 630, "og.jpg height should be 630");
  const limit = 300 * 1024;
  assert.ok(buf.length < limit, `assets/img/og.jpg is ${buf.length} bytes, over the 300 KB limit (${limit} bytes)`);
});

const qrFiles = walk(join(root, "assets/qr"))
  .filter((f) => extname(f).toLowerCase() === ".svg")
  .map((f) => relative(root, f).split("\\").join("/"))
  .sort();

// Built pages at the repo root plus the source templates that feed them.
const usageSources = [
  ...readdirSync(root).filter((n) => extname(n) === ".html").map((n) => n),
  ...readdirSync(join(root, "src")).filter((n) => extname(n) === ".html").map((n) => "src/" + n),
];
const usageText = usageSources.map((f) => read(f)).join("\n");

test("the QR svg folder has codes to check", () => {
  assert.ok(qrFiles.length >= 1, "assets/qr has no svg files");
});

for (const qr of qrFiles) {
  test(`${qr} is referenced by share.html or a built page`, () => {
    const name = qr.replace(/^assets\//, "");
    const referenced = usageText.includes(name);
    assert.ok(referenced, `${qr} is not referenced by share.html or any built page (looked for "${name}")`);
  });
}
