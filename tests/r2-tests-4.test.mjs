// Ageing and hostile-input sweep: every built page under far-future clocks, blocked storage and odd query strings.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
const BAD_TEXT = /NaN|undefined|Invalid Date|\{\{/;

function assertClean(page, label) {
  assert.deepEqual(page.errors, [], `${label}: page errors`);
  const text = page.document.body.textContent;
  const m = text.match(BAD_TEXT);
  assert.equal(m, null, `${label}: body text contains "${m && m[0]}"`);
}

const CLOCKS = { "2026-01-01": "2026-01-01T12:00:00Z", "2027-02-28": "2027-02-28T12:00:00Z", "2028-06-01": "2028-06-01T12:00:00Z" };

for (const [name, iso] of Object.entries(CLOCKS)) {
  const now = Date.parse(iso);
  for (const file of PAGES) {
    test(`${file}: clean with the clock set to ${name}`, async () => {
      const p = await loadPage(file, { now });
      try {
        assert.ok(Math.abs(new p.window.Date().getTime() - now) < 60000, "fake clock not applied");
        assertClean(p, `${file} @ ${name}`);
        if (file === "index.html" && name === "2028-06-01") {
          const soon = p.document.getElementById("soonList");
          assert.ok(soon, "missing #soonList");
          assert.match(soon.textContent, /No confirmed deadlines/);
        }
      } finally { p.window.close(); }
    });
  }
}

for (const file of PAGES) {
  test(`${file}: works when localStorage throws`, async () => {
    const p = await loadPage(file, {
      setup(w) {
        Object.defineProperty(w, "localStorage", { get() { throw new w.DOMException("denied", "SecurityError"); }, configurable: true });
      },
    });
    try {
      assertClean(p, `${file} blocked storage`);
      const btn = p.document.getElementById("themeBtn");
      if (btn) {
        const before = p.document.documentElement.getAttribute("data-theme");
        btn.click();
        const after = p.document.documentElement.getAttribute("data-theme");
        assert.ok(after === "dark" || after === "light", `data-theme is "${after}"`);
        assert.notEqual(after, before, "theme button did not flip data-theme");
        assert.deepEqual(p.errors, [], `${file}: errors after theme click`);
      }
    } finally { p.window.close(); }
  });
}

const XSS = "%22%3E%3Cimg%20id%3Dpwn%20src%3Dx%20onerror%3Dalert(1)%3E";
const HOSTILE = [
  ["find.html", "?age=abc&where=zz,,&at=city:nope&when=zzz&season=x&pay=bad&kind=bad&interest=bad&sort=bad&view=bad"],
  ["find.html", "?where=__proto__&pay=constructor"],
  ["find.html", "?q=" + XSS + "&at=" + XSS],
  ["calendar.html", "?m=99&age=abc&at=nope"],
  ["calendar.html", "?m=-1"],
  ["permit.html", "?state=__proto__&age=99&kind=zz"],
  ["paycheck.html", "?state=__proto__"],
  ["paycheck.html", "?state=constructor"],
  ["states.html", "?state=__proto__"],
  ["states.html", "?state=constructor"],
  ["younger.html", "?state=__proto__"],
  ["younger.html", "?state=constructor"],
  ["languages.html", "?lang=__proto__&state=constructor"],
  ["ready.html", "?ride=__proto__"],
  ["index.html", "?age=abc&at=zz&interest=zz"],
];

for (const [file, search] of HOSTILE) {
  test(`${file}${search.length > 70 ? search.slice(0, 70) + "..." : search}: hostile query string is handled`, async () => {
    assert.ok(PAGES.includes(file), `${file} not built`);
    const p = await loadPage(file, { search });
    try {
      assertClean(p, `${file}${search}`);
      assert.equal(p.document.getElementById("pwn"), null, "injected element exists");
    } finally { p.window.close(); }
  });
}
