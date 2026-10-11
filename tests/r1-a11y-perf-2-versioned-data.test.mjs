// Data files load by versioned URL (?v= equal to the page's common.js version), never with cache no-cache.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage } from "./dom-helper.mjs";

// find.js still fetches data/gaps.json with a bare fetch (outside this ticket's files), so it is not checked here.
const SKIP = /\/data\/gaps\.json/;

for (const file of ["index.html", "find.html", "calendar.html", "younger.html"]) {
  test(file + " requests data by versioned URL without no-cache", async () => {
    const seen = [];
    const { window, document } = await loadPage(file, { fetchLog: seen });
    const src = document.querySelector('script[src*="assets/js/common.js"]').getAttribute("src");
    const ver = /\?v=([^&"]+)$/.exec(src)[1];
    const data = seen.filter((r) => /\/data\/[^?]*\.json/.test(r.url) && !SKIP.test(r.url));
    assert.ok(data.length > 0, "page made no data request");
    for (const r of data) {
      assert.ok(r.url.endsWith("?v=" + ver), r.url + " should end with ?v=" + ver);
      assert.notEqual(r.init && r.init.cache, "no-cache", r.url);
    }
    window.close();
  });
}

test("calendar.js and younger.js use the versioned helper", () => {
  for (const f of ["calendar", "younger"]) {
    const s = fs.readFileSync(new URL("../assets/js/" + f + ".js", import.meta.url), "utf8");
    assert.ok(s.includes("G.fetchData("), f);
    assert.ok(!/[^.\w]fetch\(\s*["']data\//.test(s), f + " has a bare fetch of data/");
  }
  const c = fs.readFileSync(new URL("../assets/js/common.js", import.meta.url), "utf8");
  // no-cache is allowed only in the fallback used when the script has no ?v= version
  const hits = c.split("\n").filter((l) => l.includes("no-cache"));
  assert.ok(hits.length <= 1 && hits.every((l) => l.includes("G.fetchData = function")), "no-cache only in the G.fetchData fallback");
});
