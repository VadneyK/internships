import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const cases = [
  { file: "parents.html", sel: "pState", st: "pStatus", table: "signT", all: /all/i },
  { file: "younger.html", sel: "yState", st: "yStatus", table: "gridT", all: /all/i },
];
for (const c of cases) {
  test(c.file + ": state picker is announced in a hidden status line", async () => {
    const { document, window } = await loadPage(c.file); await tick(300);
    const hits = document.querySelectorAll(".sr[role=status]#" + c.st);
    assert.equal(hits.length, 1);
    const st = hits[0];
    assert.equal(st.textContent, "");
    const table = document.getElementById(c.table);
    assert.equal(table.closest("[aria-live], [role=status]"), null);
    const heads = table.querySelectorAll("thead th[scope=col]").length;
    const sel = document.getElementById(c.sel);
    const pick = (v) => { sel.value = v; sel.dispatchEvent(new window.Event("change", { bubbles: true })); };
    const opt = [...sel.options].find((o) => o.value);
    pick(opt.value);
    const one = st.textContent;
    assert.ok(one.length > 0);
    assert.ok(one.includes(opt.textContent), one);
    assert.match(one, /1 of \d+/);
    pick(opt.value);
    assert.equal(st.textContent, one);
    pick("");
    assert.notEqual(st.textContent, one);
    assert.match(st.textContent, c.all);
    assert.ok(heads > 0);
    assert.ok(table.querySelectorAll("thead th[scope=col]").length >= heads);
    assert.doesNotMatch(one + st.textContent, /[\u2013\u2014]/);
  });
}
