// Ticket r2-a11y-perf-2: when a page's data fails to load, its one status line says so out loud.
// Run with: node --test tests/r2-a11y-perf-2-load-failure-status.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

// page, the status element the page already owns, and the visible fallback area.
const PAGES = [
  { page: "jobs.html", status: "jStatus", area: "jOut" },
  { page: "languages.html", status: "lCount", area: "lCount" },
  { page: "paycheck.html", status: "mStatus", area: "mOut" },
  { page: "parents.html", status: "pStatus", area: "signLead" },
  { page: "interview.html", status: "aStatus", area: "aOut" },
  { page: "ready.html", status: "readyStatus", area: "rideOut" },
  { page: "states.html", status: "moreStatus", area: "moreOut" },
  { page: "permit.html", status: "pStatus", area: "pOut" },
  { page: "safety.html", status: "sStatus", area: "sbody-rights" },
  { page: "younger.html", status: "yStatus", area: "fedNote" },
  { page: "calendar.html", status: "cCount", area: "cCount" },
];

function failData(w) {
  let wrapped;
  Object.defineProperty(w, "fetch", {
    configurable: true, enumerable: true,
    get: () => wrapped,
    set: (real) => {
      wrapped = (u, o) => {
        const p = new URL(String(u), w.location.href).pathname;
        if (/\/data\/[^/]+\.json$/.test(p)) return Promise.reject(new TypeError("network down"));
        return real(u, o);
      };
    },
  });
}

for (const { page, status, area } of PAGES) {
  test(page + ": a failed data load is said in #" + status, async () => {
    const { document, window } = await loadPage(page, { setup: failData });
    await tick(300);
    const st = document.getElementById(status);
    assert.ok(st, "no #" + status);
    assert.ok(st.getAttribute("role") === "status" || st.getAttribute("aria-live") === "polite", "#" + status + " is not a live region");
    assert.match(st.textContent, /could not load/i);
    const fb = document.getElementById(area);
    assert.match(fb.textContent, /could not load/i, "visible fallback missing");
    assert.equal(document.querySelectorAll('[aria-live], [role="status"], [role="alert"]').length >= 1, true);
    window.close();
  });

  if (st_is_separate(status, area)) {
    test(page + ": a normal load leaves #" + status + " free of the failure text", async () => {
      const { document, window } = await loadPage(page);
      await tick(300);
      assert.doesNotMatch(document.getElementById(status).textContent, /could not load/i);
      window.close();
    });
  }
}

function st_is_separate(a, b) { return a !== b; }
