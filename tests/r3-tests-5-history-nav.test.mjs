// Ticket r3-tests-5: Back, Forward and Reload on pages that write state to the address bar.
// Pages: find.html, calendar.html, permit.html. Each is driven with 3 changes, then history.back(), history.forward(), and a reload.
// Today these pages use history.replaceState only and have no popstate handler, so Back leaves the page and never steps through the filters.
// Those assertions are marked as todo (they run, and a failure does not fail the suite) so the lead can file a code ticket.
// Run with: node --test tests/r3-tests-5-history-nav.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

const pressed = (el) => el.getAttribute("aria-pressed") === "true";
const fire = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };

async function settleBy(read, rounds = 40) {
  let last = null, same = 0;
  for (let i = 0; i < rounds && same < 3; i++) {
    await tick(60);
    const now = read();
    if (now === last) same++; else { same = 0; last = now; }
  }
}

const PAGES = {
  find: {
    file: "find.html",
    ready: async (d) => { for (let i = 0; i < 100 && d.getElementById("place").options.length < 2; i++) await tick(50); },
    ids: (d) => [...d.querySelectorAll("#out article.prog")].map((a) => a.id.slice(2)),
    state: (d) => ({
      q: d.getElementById("q").value, age: d.getElementById("age").value, place: d.getElementById("place").value,
      when: d.getElementById("when").value, sort: d.getElementById("sort").value,
      paid: [...d.querySelectorAll("#paidChips .chip")].map((b) => b.getAttribute("data-val") + ":" + pressed(b)),
      count: d.getElementById("count").textContent,
    }),
    changes: (w, d) => [
      () => fire(w, d.getElementById("age"), "15"),
      () => { const o = [...d.getElementById("place").options].map((x) => x.value).filter(Boolean); fire(w, d.getElementById("place"), o.includes("city:oakland") ? "city:oakland" : o[0]); },
      () => d.querySelector("#paidChips .chip").click(),
    ],
    repeat: (w, d) => fire(w, d.getElementById("age"), "15"),
    keys: (w, d) => type(w, d.getElementById("q"), "h") || 0,
  },
  calendar: {
    file: "calendar.html",
    ready: async (d) => { for (let i = 0; i < 100 && !(d.querySelector("#months .chip") && d.getElementById("cPlace").options.length > 1); i++) await tick(50); },
    ids: (d) => [...d.querySelectorAll("#cClose li, #cOpen li")].map((li) => (li.id || (li.querySelector("h3") || {}).textContent || "")),
    state: (d) => ({
      place: d.getElementById("cPlace").value, age: d.getElementById("cAge").value,
      month: [...d.querySelectorAll("#months .chip")].filter(pressed).map((b) => b.getAttribute("data-m")),
      count: d.getElementById("cCount").textContent,
    }),
    changes: (w, d) => [
      () => d.querySelector('#months .chip[data-m="7"]').click(),
      () => { const o = [...d.getElementById("cPlace").options].map((x) => x.value).filter(Boolean); fire(w, d.getElementById("cPlace"), o.includes("city:oakland") ? "city:oakland" : o[0]); },
      () => fire(w, d.getElementById("cAge"), "15"),
    ],
    repeat: (w, d) => fire(w, d.getElementById("cAge"), "15"),
  },
  permit: {
    file: "permit.html",
    ready: async (d) => { for (let i = 0; i < 100 && d.getElementById("pKind").options.length < 2; i++) await tick(50); },
    ids: (d) => [...d.querySelectorAll("#pOut h2, #pOut h3")].map((h) => h.textContent),
    state: (d) => ({ st: d.getElementById("pState").value, age: d.getElementById("pAge").value, kind: d.getElementById("pKind").value, out: d.getElementById("pOut").textContent.trim().slice(0, 200) }),
    changes: (w, d) => [
      () => fire(w, d.getElementById("pState"), "ca"),
      () => fire(w, d.getElementById("pAge"), "15"),
      () => { const o = [...d.getElementById("pKind").options].map((x) => x.value).filter(Boolean); fire(w, d.getElementById("pKind"), o[0]); },
    ],
    repeat: (w, d) => fire(w, d.getElementById("pAge"), "15"),
  },
};

function popstate(w) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 400);
    w.addEventListener("popstate", () => { clearTimeout(t); resolve(true); }, { once: true });
  });
}

for (const [name, P] of Object.entries(PAGES)) {
  test(name + ": Back, Forward and Reload keep the controls, cards and address together", async (t) => {
    const p = await loadPage(P.file);
    try {
      const { window: w, document: d } = p;
      await P.ready(d);
      const read = () => JSON.stringify(P.state(d)) + P.ids(d).join(",");
      const base = w.history.length;
      const steps = P.changes(w, d);
      const snaps = [{ search: w.location.search, state: P.state(d), ids: P.ids(d) }];
      for (const s of steps) {
        s(); await settleBy(read);
        snaps.push({ search: w.location.search, state: P.state(d), ids: P.ids(d) });
      }
      assert.notEqual(snaps[3].search, snaps[2].search, name + ": the last change should change the address");
      assert.notEqual(snaps[2].search, snaps[1].search, name + ": the second change should change the address");

      // Same value picked twice: no new entry, same address.
      const lenBefore = w.history.length, searchBefore = w.location.search;
      P.repeat(w, d); await settleBy(read);
      P.repeat(w, d); await settleBy(read);
      assert.equal(w.history.length, lenBefore, name + ": picking the same value twice added a history entry");
      assert.equal(w.location.search, searchBefore, name + ": picking the same value twice changed the address");

      // Reload from the current address: same controls and the same first 5 cards.
      const cur = w.location.search, curState = P.state(d), curIds = P.ids(d).slice(0, 5);
      const r = await loadPage(P.file, { search: cur });
      try {
        await P.ready(r.document);
        await settleBy(() => JSON.stringify(P.state(r.document)) + P.ids(r.document).join(","));
        assert.deepEqual(P.state(r.document), curState, name + ": reload changed the controls (" + cur + ")");
        assert.deepEqual(P.ids(r.document).slice(0, 5), curIds, name + ": reload changed the first 5 cards (" + cur + ")");
        assert.equal(r.window.location.search, cur, name + ": reload rewrote the address");
        assert.deepEqual(r.errors, [], name + ": console errors after reload");
      } finally { r.window.close(); }

      // Back and Forward. Todo: the page writes with replaceState and has no popstate handler, so the entry count never grows and Back cannot step back one change.
      await t.test("Back restores the state before the last change, Forward restores the last one", async (st) => {
        st.todo(name + ": only replaceState is used, so Back does not step through filters (no pushState or popstate handler)");
        assert.ok(w.history.length > base, name + ": no history entry was added by 3 changes (length " + base + " -> " + w.history.length + ")");
        const gone = popstate(w); w.history.back(); await gone; await settleBy(read);
        assert.equal(w.location.search, snaps[2].search, name + ": Back address");
        assert.deepEqual(P.state(d), snaps[2].state, name + ": Back controls");
        assert.deepEqual(P.ids(d), snaps[2].ids, name + ": Back cards");
        const fwd = popstate(w); w.history.forward(); await fwd; await settleBy(read);
        assert.equal(w.location.search, snaps[3].search, name + ": Forward address");
        assert.deepEqual(P.state(d), snaps[3].state, name + ": Forward controls");
      });

      assert.deepEqual(p.errors, [], name + ": console errors");
    } finally { p.window.close(); }
  });
}

test("find: typing in the search box does not add a history entry per keystroke", async () => {
  const p = await loadPage("find.html");
  try {
    const { window: w, document: d } = p;
    await PAGES.find.ready(d);
    const base = w.history.length;
    for (const v of ["h", "ho", "hos", "hosp", "hospi", "hospit"]) { type(w, d.getElementById("q"), v); await tick(20); }
    await tick(400);
    assert.ok(w.history.length - base <= 1, "typing 6 letters added " + (w.history.length - base) + " history entries");
    assert.equal(new w.URLSearchParams(w.location.search).get("q"), "hospit");
    assert.deepEqual(p.errors, []);
  } finally { p.window.close(); }
});
