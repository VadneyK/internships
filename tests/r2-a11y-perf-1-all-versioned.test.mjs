// Every page that loads data uses the versioned URL (?v= equal to its common.js version), never cache no-cache.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage } from "./dom-helper.mjs";

const PAGES = ["index", "find", "calendar", "younger", "jobs", "languages", "paycheck", "parents", "interview", "ready", "states", "permit", "safety"];

for (const name of PAGES) {
  test(name + ".html requests data by versioned URL without no-cache", async () => {
    const seen = [];
    const { window, document } = await loadPage(name + ".html", name === "find" ? { fetchLog: seen, search: "?where=oak" } : { fetchLog: seen });
    const src = document.querySelector('script[src*="assets/js/common.js"]').getAttribute("src");
    const ver = /\?v=([^&"]+)$/.exec(src)[1];
    const data = seen.filter((r) => /\/data\/[^?]*\.json/.test(r.url));
    if (name === "find") assert.ok(data.some((r) => /gaps\.json/.test(r.url)), "find made no gaps.json request");
    assert.ok(data.length > 0, "page made no data request");
    for (const r of data) {
      assert.ok(r.url.endsWith("?v=" + ver), r.url + " should end with ?v=" + ver);
      assert.notEqual(r.init && r.init.cache, "no-cache", r.url);
    }
    window.close();
  });
}

test("no page script outside common.js fetches a data/ path bare", () => {
  const dir = new URL("../assets/js/", import.meta.url);
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".js") && n !== "common.js")) {
    const s = fs.readFileSync(new URL(f, dir), "utf8");
    assert.ok(!/(^|[^.\w])fetch\(\s*["'`]\.?\/?data\//.test(s), f + " has a bare fetch of a data/ path");
  }
});
