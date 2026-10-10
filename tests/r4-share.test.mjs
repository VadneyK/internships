import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

for (const [page, say] of [["permit.html?state=california&age=15", /work permit answer/], ["ready.html?ride=atlanta", /get to work/]]) {
  test("share to a parent: " + page + " builds a text link from the current address when clicked, and nothing is sent", async () => {
    const { window, document, errors } = await loadPage(page); await tick(120);
    const box = document.querySelector(".share-parent[data-share]");
    assert.ok(box, "a share row");
    const [sms, copy] = [box.querySelector("a"), box.querySelector("button")];
    assert.ok(sms && copy);
    sms.addEventListener("click", (e) => e.preventDefault());
    sms.click();
    assert.match(sms.getAttribute("href"), /^sms:\?&body=/);
    const body = decodeURIComponent(sms.getAttribute("href").slice("sms:?&body=".length));
    assert.match(body, say);
    assert.ok(body.includes(window.location.href), "carries the address with the picks");
    assert.deepEqual(errors, []);
  });
}
