// QR contract for ticket r3-tests-1: the SVG files in assets/qr/ are generated once by tools/make_qr.py (segno is not
// installed in CI), so this test reads LINKS out of that file as text and checks every svg against it and the share page.
// Run with: node --test tests/r3-tests-1-qr-contract.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const lib = createRequire(import.meta.url)(join(root, "assets/js/lib.js"));

const py = read("tools/make_qr.py");
const BASE = (py.match(/^BASE\s*=\s*"([^"]+)"/m) || [])[1];
const block = (py.match(/LINKS\s*=\s*\[([\s\S]*?)\n\]/) || [])[1] || "";
const LINKS = [...block.matchAll(/\(\s*"([^"]+)"\s*,\s*"([^"]*)"\s*\)/g)].map((m) => ({ name: m[1], path: m[2] }));
const svgFiles = readdirSync(join(root, "assets/qr")).filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, -4));
const svg = (name) => read("assets/qr/" + name + ".svg");
const DASH = /[\u2013\u2014]/;

test("make_qr.py parses: a base address and a non-empty LINKS list", () => {
  assert.match(BASE, /^https:\/\/.+\/$/);
  assert.ok(LINKS.length >= 10, "LINKS parsed: " + LINKS.length);
  assert.equal(new Set(LINKS.map((l) => l.name)).size, LINKS.length, "duplicate LINKS name");
});

test("every LINKS name has an svg and every svg has a LINKS entry", () => {
  const names = LINKS.map((l) => l.name).sort();
  assert.deepEqual(svgFiles.slice().sort(), names);
});

test("each svg title and desc equal the address in LINKS", () => {
  for (const { name, path } of LINKS) {
    const doc = new JSDOM(svg(name), { contentType: "image/svg+xml" }).window.document;
    const url = BASE + path;
    assert.equal(doc.querySelector("title").textContent, url, name + " title");
    assert.equal(doc.querySelector("desc").textContent, "QR code for " + url, name + " desc");
  }
});

test("each link points at a built root page, and find.html where= values are real place ids", () => {
  const hubs = lib.HUBS.map((h) => h[0]);
  const ids = new Set([...hubs, ...lib.CITIES.map((c) => c[0]), ...lib.AREAS.map((a) => a[0])]);
  for (const { name, path } of LINKS) {
    const file = path.split("?")[0] || "index.html";
    assert.ok(!file.includes("/") && existsSync(join(root, file)), name + ": no built root page " + file);
    const where = new URLSearchParams(path.split("?")[1] || "").get("where");
    if (file === "find.html") assert.ok(where, name + ": find.html link needs where=");
    if (where) for (const w of where.split(",")) {
      assert.ok(ids.has(w), name + ": unknown place id " + w);
      assert.ok(hubs.includes(w), name + ": find.html reads where= as an area hub id, got " + w);
    }
  }
});

test("each svg has a viewBox, no script or external href, and a real path", () => {
  for (const name of svgFiles) {
    const s = svg(name);
    assert.match(s, /<svg[^>]*\sviewBox="0 0 \d+ \d+"/, name + " viewBox");
    assert.ok(!/<script|\son\w+\s*=|javascript:/i.test(s), name + " has script");
    assert.ok(!/href\s*=/i.test(s), name + " has an href");
    assert.ok(!/<(image|foreignObject|use)\b/i.test(s), name + " pulls in outside content");
    const d = [...s.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]).sort((a, b) => b.length - a.length)[0] || "";
    assert.ok(d.length > 500, name + " QR path too short: " + d.length);
    assert.ok(!DASH.test(s), name + " has a dash character");
  }
});

test("share.html shows the same address text and link for each card", () => {
  const doc = new JSDOM(read("share.html")).window.document;
  const cards = [...doc.querySelectorAll(".qrcard")];
  assert.equal(cards.length, LINKS.length, "card count");
  for (const { name, path } of LINKS) {
    const card = cards.find((c) => c.getAttribute("data-name") === name);
    assert.ok(card, "no share card for " + name);
    const shown = BASE.replace(/^https:\/\//, "") + path;
    assert.equal(card.querySelector("code").textContent, shown, name + " printed address");
    assert.equal(card.querySelector("[data-copy-link]").getAttribute("data-copy-link"), BASE + path, name + " copy link");
    assert.equal(card.querySelector("img").getAttribute("src"), "assets/qr/" + name + ".svg", name + " img src");
    assert.ok(card.querySelector("img").getAttribute("alt").includes(shown), name + " alt text address");
  }
});
