// Sends no referrer from the guide. Every built page must carry one <meta name="referrer" content="no-referrer">
// in <head>, before the first stylesheet link, so a teen's address (age, state, search words in the query string)
// is not passed to the outside sites the guide links to. Run with:
//   node --test tests/r5-a11y-perf-5-referrer-policy.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_HTML = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

test("every built page has exactly one no-referrer meta, in head, before the first stylesheet", () => {
  assert.ok(ROOT_HTML.length > 0, "no built html pages found; run python3 tools/build.py");
  for (const f of ROOT_HTML) {
    const dom = new JSDOM(fs.readFileSync(path.join(ROOT, f), "utf8"));
    const doc = dom.window.document;
    const metas = doc.querySelectorAll('meta[name="referrer"]');
    assert.equal(metas.length, 1, f + ": expected exactly one referrer meta, found " + metas.length);
    const meta = metas[0];
    assert.equal(meta.getAttribute("content"), "no-referrer", f + ": referrer content");
    assert.ok(doc.head.contains(meta), f + ": referrer meta is not inside head");
    const firstSheet = doc.querySelector('link[rel~="stylesheet"]');
    assert.ok(firstSheet, f + ": no stylesheet link found");
    // DOCUMENT_POSITION_FOLLOWING (4): the stylesheet comes after the meta in document order.
    assert.ok(meta.compareDocumentPosition(firstSheet) & 4, f + ": referrer meta must come before the first stylesheet link");
  }
});

// find.html reads its filters from age, at (place, for example state:ohio), pay, kind and so on. It has no "state"
// parameter, so persist() drops unknown keys; the test uses the place filter the page really keeps.
test("find page keeps its filters in the address while the referrer meta is present", async () => {
  const { window, document, errors } = await loadPage("find.html", { search: "?age=15&at=state:ohio" });
  const meta = document.querySelector('meta[name="referrer"]');
  assert.ok(meta, "referrer meta missing on find.html");
  assert.equal(meta.getAttribute("content"), "no-referrer");
  assert.ok(document.head.contains(meta), "referrer meta is not inside head");
  assert.match(window.location.search, /age=15/, "age filter dropped from the address");
  assert.match(window.location.search, /at=state%3Aohio|at=state:ohio/, "place filter dropped from the address");
  assert.deepEqual(errors, [], "page logged errors: " + errors.join(" | "));
});
