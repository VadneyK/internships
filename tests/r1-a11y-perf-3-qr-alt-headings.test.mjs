// Ticket r1-a11y-perf-3: QR code pictures on share.html and handout.html.
// Short alt text (the address is printed as text), h3 card titles, and no inline style on the QR images.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const docOf = (p) => new JSDOM(read(p)).window.document;

const share = docOf("share.html");
const handout = docOf("handout.html");

test("every QR image has short alt text that starts with QR code and shows no address", () => {
  for (const [name, doc] of [["share.html", share], ["handout.html", handout]]) {
    const imgs = [...doc.querySelectorAll('img[src^="assets/qr/"]')];
    assert.ok(imgs.length >= 1, name + " has QR images");
    for (const img of imgs) {
      const alt = img.getAttribute("alt") || "";
      assert.ok(alt.startsWith("QR code"), name + ": " + alt);
      assert.ok(alt.length <= 60, name + " alt too long: " + alt);
      assert.ok(!alt.includes("http"), name + " alt has http: " + alt);
      assert.ok(!alt.includes("/"), name + " alt has slash: " + alt);
    }
  }
});

test("each QR card title is an h3", () => {
  const cards = [...share.querySelectorAll(".qrcard")];
  assert.equal(cards.length, 10);
  for (const card of cards) {
    const h = card.querySelector("h2, h3, h4");
    assert.ok(h, "card has a heading");
    assert.equal(h.tagName, "H3", card.getAttribute("data-name") + " heading level");
  }
});

test("no QR image carries a style attribute", () => {
  for (const doc of [share, handout]) {
    for (const img of doc.querySelectorAll('img[src^="assets/qr/"]')) {
      assert.ok(!img.hasAttribute("style"), img.getAttribute("src") + " has inline style");
    }
  }
});

test("style.css gives QR cards a white background and a border", () => {
  const css = read("assets/css/style.css");
  const rule = css.match(/\.qrcard img[^{]*\{([^}]*)\}/);
  assert.ok(rule, "no .qrcard img rule");
  assert.match(rule[1], /background:\s*#fff\b/);
  assert.match(rule[1], /border:/);
});

test("the white quiet zone rule covers .qrcard img, .handout-code img and #qrPrint img, and no later rule overrides it", () => {
  const css = read("assets/css/style.css");
  const rule = css.match(/([^{}]*\.qrcard img[^{]*)\{([^}]*)\}/);
  assert.ok(rule, "no .qrcard img rule");
  for (const sel of [".qrcard img", ".handout-code img", "#qrPrint img"]) {
    assert.ok(rule[1].includes(sel), sel + " missing from the white background rule");
  }
  assert.match(rule[2], /background:\s*#fff\b/);
  // Any other rule that names these images (dark mode, print, or elsewhere) must not set a background of its own.
  const imgRules = [...css.matchAll(/([^{}]*)\{([^}]*)\}/g)].filter(
    (m) => m[1] !== rule[1] && /\.qrcard img|\.handout-code img|#qrPrint img/.test(m[1])
  );
  for (const m of imgRules) {
    assert.doesNotMatch(m[2], /background(-color)?:/, "a later rule overrides the QR background: " + m[1].trim());
  }
});
