// The saved list is never dropped silently, and the page says when the browser cannot keep it.
// Run with: node --test tests/r1-ranking-ux-6.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

async function firstId() {
  const p = await loadPage("find.html");
  const id = p.document.querySelector("article.prog .star").getAttribute("data-id");
  p.window.close();
  return id;
}

test("an unknown saved id is not counted and not deleted from storage", async () => {
  const id = await firstId();
  const { window, document, errors } = await loadPage("find.html", { storage: { saved: ["not-a-real-id", id] } });
  try {
    assert.equal(document.getElementById("savedN").textContent, "1");
    assert.deepEqual(JSON.parse(window.localStorage.getItem("saved")), ["not-a-real-id", id]);
    document.getElementById("savedOnly").click();
    await tick();
    assert.equal(document.querySelectorAll("article.prog").length, 1);
    // unsaving the real one keeps the unknown id and shows the empty list card
    document.querySelector('.star[data-id="' + id + '"]').click();
    assert.deepEqual(JSON.parse(window.localStorage.getItem("saved")), ["not-a-real-id"]);
    assert.equal(document.getElementById("savedN").textContent, "0");
    assert.ok(/Your list is empty/.test(document.getElementById("out").textContent));
    assert.deepEqual(errors, []);
  } finally { window.close(); }
});

test("when the browser refuses writes, the star stays on, the count holds and a toast says so", async () => {
  const { window, document, errors } = await loadPage("find.html", {
    setup(w) { w.Storage.prototype.setItem = function () { throw new Error("blocked"); }; },
  });
  try {
    const star = document.querySelector("article.prog .star");
    const id = star.getAttribute("data-id");
    star.click();
    assert.equal(star.getAttribute("aria-pressed"), "true");
    assert.ok(/will not keep/.test(document.getElementById("toast").textContent), document.getElementById("toast").textContent);
    assert.equal(document.getElementById("savedN").textContent, "1");
    const sort = document.getElementById("sort"), first = sort.value;
    const other = Array.from(sort.options).map((o) => o.value).find((v) => v !== first);
    for (const v of [other, first]) { // re-render twice, then the same first page is back
      sort.value = v;
      sort.dispatchEvent(new window.Event("change", { bubbles: true }));
      await tick();
    }
    assert.equal(document.querySelector('.star[data-id="' + id + '"]').getAttribute("aria-pressed"), "true");
    assert.equal(document.getElementById("savedN").textContent, "1");
    assert.deepEqual(errors, []);
  } finally { window.close(); }
});

test("storage disabled completely: find.html and index.html load with no errors", async () => {
  for (const file of ["find.html", "index.html"]) {
    const p = await loadPage(file, {
      setup(w) {
        const boom = () => { throw new Error("storage disabled"); };
        w.Storage.prototype.getItem = boom; w.Storage.prototype.setItem = boom; w.Storage.prototype.removeItem = boom;
      },
    });
    try {
      assert.deepEqual(p.errors, [], file);
      if (file === "find.html") {
        assert.ok(p.document.querySelectorAll("article.prog").length > 0);
        assert.equal(p.document.getElementById("savedN").textContent, "0");
      }
    } finally { p.window.close(); }
  }
});

test("damaged saved values still load with no errors and no NaN", async () => {
  for (const file of ["find.html", "index.html"]) {
    for (const value of ["null", "5", '{"a":1}', "[null,5]"]) {
      const p = await loadPage(file, { rawStorage: { saved: value } });
      try {
        assert.deepEqual(p.errors, [], file + " " + value);
        assert.ok(!/NaN/.test(p.document.body.textContent), file + " " + value);
        if (file === "find.html") assert.equal(p.document.getElementById("savedN").textContent, "0", value);
      } finally { p.window.close(); }
    }
  }
});
