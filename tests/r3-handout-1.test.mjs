// Ticket r3-handout-1: the printable handout page for teachers and counselors.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const html = read("handout.html");
const doc = new JSDOM(html).window.document;
const meta = JSON.parse(read("data/meta.json"));

test("title is right and the page is not noindex", () => {
  assert.equal(doc.title.split("|")[0].trim().replace(/\s+/g, " ").slice(0, 36), "Handout for teachers and counselors");
  assert.equal(doc.querySelector('meta[name="robots"]'), null);
});

test("one h1, the address as text, and the static home QR", () => {
  assert.equal(doc.querySelectorAll("h1").length, 1);
  assert.ok(doc.querySelector("main").textContent.includes("vadneyk.github.io/internships/"));
  const img = doc.querySelector('main img[src="assets/qr/home.svg"]');
  assert.ok(img && img.getAttribute("alt"));
  assert.ok(fs.existsSync(path.join(ROOT, "assets/qr/home.svg")));
});

test("three steps, what it is not, and the last checked date", () => {
  assert.equal(doc.querySelectorAll(".handout-steps li").length, 3);
  assert.equal(doc.querySelectorAll(".handout-not li").length, 4);
  assert.ok(doc.querySelector(".handout-foot").textContent.includes("Last checked " + meta.checked_label));
});

test("print button, breadcrumb, footer link and no new scripts", () => {
  assert.ok(doc.getElementById("handoutPrint"));
  assert.equal(doc.querySelectorAll('nav[aria-label="Breadcrumb"]').length, 1);
  assert.ok(doc.querySelector('.foot a[href="handout.html"]'));
  const srcs = [...doc.querySelectorAll("script[src]")].map((s) => s.getAttribute("src"));
  assert.ok(srcs.every((s) => s.startsWith("assets/")), "external script found");
  assert.ok(read("sitemap.xml").includes("handout.html"));
});

test("print CSS hides nav, footer and buttons", () => {
  const css = read("assets/css/style.css");
  assert.match(css, /\.top, \.foot, \.noprint[^{]*\{ display: none !important/);
  assert.match(css, /main button:not\(\.tile\) \{ display: none !important/);
  assert.match(css, /\.handout-code img \{ width: 2\.2in/);
});

test("no em or en dash in the page or script", () => {
  for (const t of [html, read("assets/js/handout.js"), read("src/handout.html")]) assert.ok(!/[\u2013\u2014]/.test(t));
});
