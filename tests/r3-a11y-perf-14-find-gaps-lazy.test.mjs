// find.html loads data/gaps.json only after a place or hub is chosen, once per page load, by the versioned URL.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick, waitFor } from "./dom-helper.mjs";

// the page asks for a relative URL, the fetch log holds an absolute one, so match without the leading slash
const GAPS_URL = /data\/gaps\.json/;
const HEADING = "Known gaps in this area";

function gapRequests(seen) {
  return seen.filter((r) => GAPS_URL.test(r.url));
}

test("find.html with no place or hub never requests gaps.json and keeps #gaps empty", async () => {
  const seen = [];
  const { window, document, errors } = await loadPage("find.html", { fetchLog: seen });
  await tick(150);
  assert.deepEqual(errors, []);
  assert.equal(gapRequests(seen).length, 0, "no place chosen, so no gaps request");
  const box = document.getElementById("gaps");
  assert.equal(box.hidden, true);
  assert.equal(box.innerHTML, "");
  assert.ok(document.getElementById("out").children.length > 0, "cards still show");
  window.close();
});

test("choosing a place requests gaps.json once, by the versioned URL, and shows the heading", async () => {
  const seen = [];
  const { window, document } = await loadPage("find.html", { fetchLog: seen });
  const src = document.querySelector('script[src*="assets/js/common.js"]').getAttribute("src");
  const ver = /\?v=([^&"]+)$/.exec(src)[1];
  await tick(150);
  assert.equal(gapRequests(seen).length, 0);

  type(window, document.getElementById("place"), "city:davis");
  // Wait for the gaps box instead of a fixed 150 ms: a loaded machine was slower than that (2026-10-16). Then a beat for a stray second request.
  await waitFor(() => !document.getElementById("gaps").hidden);
  await tick(150);
  const reqs = gapRequests(seen);
  assert.equal(reqs.length, 1, "exactly one gaps request");
  assert.ok(reqs[0].url.endsWith("?v=" + ver), reqs[0].url + " should end with ?v=" + ver);
  assert.notEqual(reqs[0].init && reqs[0].init.cache, "no-cache");
  const box = document.getElementById("gaps");
  assert.equal(box.hidden, false);
  assert.ok(box.textContent.includes(HEADING), "heading shown for a hub with gaps");
  window.close();
});

test("loading with ?where=oak requests gaps.json once and shows the East Bay gap", async () => {
  const seen = [];
  const { window, document } = await loadPage("find.html", { search: "?where=oak", fetchLog: seen });
  await waitFor(() => !document.getElementById("gaps").hidden);
  await tick(150);
  assert.equal(gapRequests(seen).length, 1, "exactly one gaps request");
  const box = document.getElementById("gaps");
  assert.equal(box.hidden, false);
  assert.ok(box.textContent.includes(HEADING));
  assert.ok(box.querySelector('a[href$="/issues/2"]'));
  window.close();
});

test("picking a second place does not request gaps.json again", async () => {
  const seen = [];
  const { window, document } = await loadPage("find.html", { fetchLog: seen });
  type(window, document.getElementById("place"), "city:davis");
  await waitFor(() => !document.getElementById("gaps").hidden);
  type(window, document.getElementById("place"), "city:berkeley");
  await waitFor(() => document.querySelector('#gaps a[href$="/issues/2"]'));
  await tick(150);
  assert.equal(gapRequests(seen).length, 1, "still one gaps request after two places");
  const box = document.getElementById("gaps");
  assert.equal(box.hidden, false);
  assert.ok(box.querySelector('a[href$="/issues/2"]'), "East Bay gap now shows");
  window.close();
});

test("a failed gaps.json fetch leaves the cards up and logs no console error", async () => {
  const attempts = [];
  const setup = (w) => {
    // loadPage assigns w.fetch after setup runs, so a setter wraps the assigned function and rejects gaps.json only
    let real = null;
    Object.defineProperty(w, "fetch", {
      configurable: true,
      get() {
        return (u, o) => {
          if (GAPS_URL.test(String(u))) { attempts.push(String(u)); return Promise.reject(new TypeError("offline")); }
          return real(u, o);
        };
      },
      set(f) { real = f; },
    });
  };
  const { window, document, errors } = await loadPage("find.html", { search: "?where=oak", setup });
  await waitFor(() => attempts.length > 0);
  await tick(150);
  assert.equal(attempts.length, 1, "the gaps file was tried once");
  assert.deepEqual(errors, []);
  assert.ok(document.getElementById("out").children.length > 0, "cards still show");
  assert.equal(document.getElementById("gaps").hidden, true);
  window.close();
});
