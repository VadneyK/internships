// Head, sitemap, robots and asset checks for every built page.
// Run with: node --test tests/r2-tests-5.test.mjs
// Plain node: fs and regex only, no jsdom. Reads the generated pages in the repo root.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://vadneyk.github.io/internships/";

// Ratchet: search results cut off long text. Lower these numbers when a page is shortened.
// Current maxima: title 87 (paycheck.html), description 309 (paycheck.html).
const MAX_TITLE_LENGTH = 90;
const MAX_DESCRIPTION_LENGTH = 310;

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const readBytes = (rel) => readFileSync(join(ROOT, rel));

const pages = readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
const htmlOf = Object.fromEntries(pages.map((p) => [p, read(p)]));

// The text between <head> and </head>.
function headOf(html) {
  const m = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  return m ? m[1] : "";
}

// Parse the attributes of one start tag, lower-cased names, double-quoted values.
function attrs(s) {
  const out = {};
  for (const m of s.matchAll(/([a-zA-Z_:-]+)\s*=\s*"([^"]*)"/g)) {
    out[m[1].toLowerCase()] = m[2];
  }
  return out;
}

// Every start tag with the given name inside a block of HTML.
function tags(block, name) {
  const re = new RegExp(`<${name}\\b([^>]*)>`, "gi");
  return [...block.matchAll(re)].map((m) => attrs(m[1]));
}

function titleOf(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : "";
}

function metaNamed(html, name) {
  const hit = tags(headOf(html), "meta").find((a) => a.name === name);
  return hit ? hit.content : undefined;
}

function metaProperty(html, property) {
  const hit = tags(headOf(html), "meta").find((a) => a.property === property);
  return hit ? hit.content : undefined;
}

function canonicalOf(html) {
  const hit = tags(headOf(html), "link").find((a) => a.rel === "canonical");
  return hit ? hit.href : undefined;
}

function isNoindex(html) {
  const content = metaNamed(html, "robots");
  if (content === undefined) return false;
  return content.split(",").map((s) => s.trim().toLowerCase()).includes("noindex");
}

function expectedCanonical(page) {
  return page === "index.html" ? BASE : BASE + page;
}

// Minimal JPEG reader: walk the marker segments until a start-of-frame marker.
// Returns the pixel size stored in that marker. No dependency.
function jpegSize(buf) {
  assert.equal(buf[0], 0xff, "not a JPEG: first byte");
  assert.equal(buf[1], 0xd8, "not a JPEG: missing SOI marker");
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error(`bad marker byte at offset ${i}`);
    let marker = buf[i + 1];
    while (marker === 0xff) {
      i += 1;
      marker = buf[i + 1];
    }
    if (marker === 0xd9 || marker === 0xda) throw new Error("reached EOI or SOS before a frame header");
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    const segmentLength = buf.readUInt16BE(i + 2);
    i += 2 + segmentLength;
  }
  throw new Error("no start-of-frame marker found");
}

const meta = JSON.parse(read("data/meta.json"));

test("the repo has built pages to check", () => {
  assert.ok(pages.length >= 1, "no root *.html files found");
  assert.ok(pages.includes("index.html"), "index.html is missing");
  assert.ok(pages.includes("404.html"), "404.html is missing");
});

test("every page has a non-empty title and description", () => {
  for (const page of pages) {
    assert.notEqual(titleOf(htmlOf[page]), "", `${page}: empty <title>`);
    assert.notEqual(metaNamed(htmlOf[page], "description"), undefined, `${page}: no meta description`);
    assert.notEqual(metaNamed(htmlOf[page], "description").trim(), "", `${page}: empty meta description`);
  }
});

test("page titles are unique", () => {
  const seen = new Map();
  for (const page of pages) {
    const t = titleOf(htmlOf[page]);
    if (!seen.has(t)) seen.set(t, []);
    seen.get(t).push(page);
  }
  const dupes = [...seen.entries()].filter(([, files]) => files.length > 1);
  assert.deepEqual(dupes, [], "pages sharing a title");
});

test("page descriptions are unique", () => {
  const seen = new Map();
  for (const page of pages) {
    const d = metaNamed(htmlOf[page], "description");
    if (!seen.has(d)) seen.set(d, []);
    seen.get(d).push(page);
  }
  const dupes = [...seen.entries()].filter(([, files]) => files.length > 1);
  assert.deepEqual(dupes, [], "pages sharing a description");
});

test("titles stay within the length ratchet", () => {
  const over = pages
    .map((p) => [p, titleOf(htmlOf[p]).length])
    .filter(([, n]) => n > MAX_TITLE_LENGTH);
  assert.deepEqual(over, [], `titles longer than ${MAX_TITLE_LENGTH} characters`);
});

test("descriptions stay within the length ratchet", () => {
  const over = pages
    .map((p) => [p, metaNamed(htmlOf[p], "description").length])
    .filter(([, n]) => n > MAX_DESCRIPTION_LENGTH);
  assert.deepEqual(over, [], `descriptions longer than ${MAX_DESCRIPTION_LENGTH} characters`);
});

test("each page's rel=canonical is the full URL of its own file", () => {
  for (const page of pages) {
    assert.equal(canonicalOf(htmlOf[page]), expectedCanonical(page), `${page}: canonical`);
  }
});

test("og:url equals the canonical URL on every page", () => {
  for (const page of pages) {
    assert.equal(metaProperty(htmlOf[page], "og:url"), canonicalOf(htmlOf[page]), `${page}: og:url`);
  }
});

test("og:title equals <title> and og:description equals the meta description", () => {
  for (const page of pages) {
    const html = htmlOf[page];
    assert.equal(metaProperty(html, "og:title"), titleOf(html), `${page}: og:title`);
    assert.equal(metaProperty(html, "og:description"), metaNamed(html, "description"), `${page}: og:description`);
  }
});

test("every page declares lang=en and a viewport meta", () => {
  for (const page of pages) {
    const html = htmlOf[page];
    assert.match(html, /<html\b[^>]*\blang="en"/i, `${page}: <html lang="en">`);
    assert.match(metaNamed(html, "viewport") ?? "", /width=device-width/, `${page}: viewport meta`);
  }
});

test("sitemap.xml lists exactly the indexable built pages", () => {
  const xml = read("sitemap.xml");
  const entries = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<\/url>/g)];
  assert.equal(
    (xml.match(/<url>/g) || []).length,
    entries.length,
    "every <url> needs a <loc> and a <lastmod> in that order",
  );

  const locs = entries.map((e) => e[1]);
  assert.equal(new Set(locs).size, locs.length, "duplicate <loc> entries");

  const fileOfLoc = (loc) => {
    assert.ok(loc.startsWith(BASE), `<loc> outside the site base: ${loc}`);
    return loc === BASE ? "index.html" : loc.slice(BASE.length);
  };
  const listed = locs.map(fileOfLoc).sort();

  const expected = pages
    .filter((p) => p !== "404.html" && !isNoindex(htmlOf[p]))
    .sort();
  assert.deepEqual(listed, expected, "sitemap entries differ from the indexable pages");
});

test("every sitemap <loc> maps to an existing file", () => {
  const xml = read("sitemap.xml");
  for (const [, loc] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const file = loc === BASE ? "index.html" : loc.slice(BASE.length);
    assert.ok(existsSync(join(ROOT, file)), `${loc} points at missing file ${file}`);
  }
});

test("every sitemap <lastmod> is a real date equal to data/meta.json checked", () => {
  const xml = read("sitemap.xml");
  const dates = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  assert.ok(dates.length > 0, "no <lastmod> entries");
  for (const v of dates) {
    assert.match(v, /^\d{4}-\d{2}-\d{2}$/, `<lastmod> not YYYY-MM-DD: ${v}`);
    const d = new Date(`${v}T00:00:00Z`);
    assert.ok(!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v, `<lastmod> not a real date: ${v}`);
    assert.equal(v, meta.checked, `<lastmod> ${v} differs from data/meta.json checked`);
  }
});

test("robots.txt points at the sitemap on the same base", () => {
  const lines = read("robots.txt").split(/\r?\n/).map((l) => l.trim());
  assert.ok(lines.includes(`Sitemap: ${BASE}sitemap.xml`), "robots.txt is missing the Sitemap line");
  assert.ok(existsSync(join(ROOT, "sitemap.xml")), "sitemap.xml is missing");
});

test("the social preview image is a 1200 by 630 JPEG", () => {
  const rel = "assets/img/og.jpg";
  assert.ok(existsSync(join(ROOT, rel)), `${rel} is missing`);
  const size = jpegSize(readBytes(rel));
  assert.deepEqual({ width: size.width, height: size.height }, { width: 1200, height: 630 });
});

test("favicon and icon files exist and are not empty", () => {
  for (const rel of ["favicon.ico", "apple-touch-icon.png", "assets/img/favicon.svg"]) {
    assert.ok(existsSync(join(ROOT, rel)), `${rel} is missing`);
    assert.ok(statSync(join(ROOT, rel)).size > 0, `${rel} is empty`);
  }
});

test("every url(../fonts/x) in assets/css resolves to a real font file", () => {
  const cssDir = join(ROOT, "assets/css");
  const cssFiles = readdirSync(cssDir).filter((f) => f.endsWith(".css"));
  const refs = [];
  for (const css of cssFiles) {
    const text = readFileSync(join(cssDir, css), "utf8");
    for (const m of text.matchAll(/url\(\s*(['"]?)\.\.\/fonts\/([^'")\s]+)\1\s*\)/g)) {
      refs.push([css, m[2]]);
    }
  }
  assert.ok(refs.length > 0, "no font url() references found, check the pattern");
  const missing = refs
    .filter(([, name]) => !existsSync(join(ROOT, "assets/fonts", name)))
    .map(([css, name]) => `${css} -> ${name}`);
  assert.deepEqual(missing, [], "font files referenced by CSS but not on disk");
});

test("every rel=preload href in the pages resolves to a real file", () => {
  const missing = [];
  const checkedPerPage = {};
  for (const page of pages) {
    checkedPerPage[page] = 0;
    for (const a of tags(headOf(htmlOf[page]), "link")) {
      if (a.rel !== "preload") continue;
      checkedPerPage[page] += 1;
      const href = a.href ?? "";
      if (!href || href.startsWith("/") || /^https?:\/\//.test(href) || href.startsWith("//")) {
        missing.push(`${page}: preload href must be a relative path, got "${href}"`);
        continue;
      }
      const file = href.split(/[?#]/)[0];
      if (!existsSync(join(ROOT, file))) missing.push(`${page}: ${href}`);
    }
  }
  // Guard against the parser silently matching nothing: every page has font preloads today.
  const withoutPreload = Object.entries(checkedPerPage).filter(([, n]) => n === 0).map(([p]) => p);
  assert.deepEqual(withoutPreload, [], "pages with no rel=preload links found, check the parser");
  assert.deepEqual(missing, [], "preload hrefs that do not resolve");
});
