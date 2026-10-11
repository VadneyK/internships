import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

test("ready: the California note is a closed details with a visible summary", async () => {
  const { document } = await loadPage("ready.html");
  const fold = [...document.querySelectorAll("details")].find((d) => d.querySelector("summary")?.textContent.trim() === "Which parts are only for California?");
  assert.ok(fold, "a details element with the California summary should exist");
  assert.equal(fold.open, false, "the California note should be closed on load");
  assert.ok(fold.querySelector("summary"), "the summary should stay visible as the closed element's first child");
});

test("ready: the checklist comes up the screen, with at most one callout above it", async () => {
  const { document } = await loadPage("ready.html");
  const list = document.getElementById("readyList");
  assert.ok(list, "#readyList should exist");
  const before = [...document.querySelectorAll(".callout")].filter(
    (c) => c.compareDocumentPosition(list) & document.DOCUMENT_POSITION_FOLLOWING,
  );
  assert.ok(before.length <= 1, "at most one callout should come before #readyList, found " + before.length);
});
