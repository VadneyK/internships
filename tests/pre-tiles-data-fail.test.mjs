// 2026-10-15: tools/build.py ships picker tiles (data-pre) so pages keep their shape while data loads. If the data
// never loads, those tiles would stay as buttons that do nothing; G.dropPreTiles removes them next to the error message.
// Run with: node --test tests/pre-tiles-data-fail.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, waitFor } from "./dom-helper.mjs";

const CASES = [
  ["permit.html", /permits\.json/, "pStatus", /could not load/],
  ["jobs.html", /employers|state-wages|jobs/, "jStatus", /could not load/],
  ["calendar.html", /entries/, "cCount", /could not load/],
];

for (const [page, rx, id, msg] of CASES) {
  test(page + ": a failed data load removes the build-time tiles and shows the error", async () => {
    const { document } = await loadPage(page, { fetchFail: rx });
    await waitFor(() => msg.test(document.getElementById(id).textContent), { timeout: 15000 });
    assert.equal(document.querySelectorAll(".tp[data-pre]").length, 0);
  });
  test(page + ": a normal load adopts the build-time tiles (none left with data-pre)", async () => {
    const { document } = await loadPage(page);
    await waitFor(() => !document.querySelector(".tp[data-pre]"), { timeout: 15000 });
    assert.ok(document.querySelectorAll(".tp .tile").length > 3);
  });
}
