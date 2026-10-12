// The new-tab observer only scans nodes that were added, so counts, status text and its own note cost no link reads.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

test("the observer scans only added links", async () => {
  const { window, document } = await loadPage("find.html");
  await tick(200);
  const main = document.querySelector("main");
  let html = "";
  for (let i = 0; i < 300; i++) html += '<a href="https://example.org/p' + i + '" target="_blank" rel="noopener">Link ' + i + "</a>";
  main.insertAdjacentHTML("beforeend", "<div>" + html + "</div>");
  await tick(50);

  const proto = window.HTMLAnchorElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "href");
  let reads = 0;
  Object.defineProperty(proto, "href", { configurable: true, get() { reads++; return desc.get.call(this); }, set(v) { desc.set.call(this, v); } });
  try {
    reads = 0;
    const card = document.createElement("div");
    card.innerHTML = '<a id="n1" href="https://example.org/a" target="_blank" rel="noopener">A</a><a id="n2" href="https://example.org/b.pdf">B</a>';
    main.appendChild(card);
    await Promise.resolve(); await Promise.resolve(); await tick(20);
    assert.ok(reads > 0 && reads <= 6, "reads for one card: " + reads);
    const afterCard = reads;
    await Promise.resolve(); await Promise.resolve(); await tick(20);
    assert.equal(reads, afterCard, "the note the observer adds does not trigger another pass");
    const n1 = document.getElementById("n1"), n2 = document.getElementById("n2");
    assert.equal(n1.querySelectorAll("span.sr[data-newtab]").length, 1);
    assert.equal(n2.querySelectorAll("span.sr[data-pdfnote]").length, 1);
    assert.match(n2.textContent, /PDF/);

    const status = document.createElement("p"); status.id = "status-x"; main.appendChild(status);
    await tick(20);
    reads = 0;
    status.textContent = "12 results"; status.textContent = "13 results";
    const count = document.getElementById("count");
    if (count) count.textContent = "99";
    await tick(20);
    assert.equal(reads, 0, "text changes read href 0 times");
  } finally {
    Object.defineProperty(proto, "href", desc);
  }
});
