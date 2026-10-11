// The Copy confirmation is a live region (#toast). A repeat of the same message must go empty and back,
// so screen readers announce it again, and the text must be cleared after the toast fades.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

test("#toast: a repeated message is re-announced, and stale text is cleared after the fade", async () => {
  const { document, window, errors } = await loadPage("share.html"); await tick(100);
  const toast = document.getElementById("toast");
  assert.ok(toast, "share.html has a #toast element");
  assert.equal(toast.getAttribute("role"), "status");
  assert.equal(toast.getAttribute("aria-live"), "polite");

  // Record every text value the live region gets, in order, without repeats in a row.
  const seen = [];
  const observer = new window.MutationObserver(() => {
    const text = toast.textContent;
    if (seen[seen.length - 1] !== text) seen.push(text);
  });
  observer.observe(toast, { childList: true, characterData: true, subtree: true });

  window.TIG.toast("Copied");
  assert.ok(toast.classList.contains("show"), "show is set right after the first call");
  await tick(100);
  const firstIdx = seen.indexOf("Copied");
  assert.ok(firstIdx >= 0, "the first message is set: " + JSON.stringify(seen));

  window.TIG.toast("Copied");
  assert.ok(toast.classList.contains("show"), "show is set right after the second call");
  await tick(150);

  // After the first message, the region must go empty and then get "Copied" again.
  const after = seen.slice(firstIdx + 1);
  const emptyAt = after.indexOf("");
  assert.ok(emptyAt >= 0, "text went empty between the two calls: " + JSON.stringify(seen));
  assert.ok(after.slice(emptyAt + 1).includes("Copied"), "Copied was set again after the empty step: " + JSON.stringify(seen));
  assert.equal(toast.textContent, "Copied");

  // Wait until 3 seconds after the last call (the fade is at 2.2 s), then check nothing stale is left.
  await tick(2850);
  assert.equal(toast.classList.contains("show"), false, "show is gone after 3 seconds");
  assert.equal(toast.textContent, "", "stale text is cleared after the fade");

  observer.disconnect();
  assert.deepEqual(errors, []);
});

test("G.copy fallback (no clipboard API) still confirms with Copied or the Ctrl+C message", async () => {
  const { document, window, errors } = await loadPage("share.html"); await tick(100);
  const toast = document.getElementById("toast");
  assert.equal(window.navigator.clipboard, undefined, "jsdom has no clipboard API, so the fallback runs");
  window.TIG.copy("sample text");
  await tick(80);
  assert.ok(/^(Copied|Press Ctrl\+C or Cmd\+C to copy)$/.test(toast.textContent), toast.textContent);
  assert.equal(toast.classList.contains("show"), true);
  assert.deepEqual(errors, []);
});
