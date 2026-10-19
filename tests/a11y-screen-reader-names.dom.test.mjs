// Screen reader pass for issue 9 (2026-10-18). Three things a screen reader user hears that sighted users see from layout:
// the sub row of a grouped tile picker is a named group, and repeated link texts ("See card", "Official page") carry the program or group name.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, waitFor } from "./dom-helper.mjs";

test("find: each sub row of the Where tiles is a group named after its region", async () => {
  const { document } = await loadPage("find.html");
  await waitFor(() => document.querySelectorAll("#place + .tp .tp-sub").length > 0);
  const subs = [...document.querySelectorAll("#place + .tp .tp-sub")];
  assert.ok(subs.length >= 3, "grouped sub rows exist");
  const openers = [...document.querySelectorAll("#place + .tp [aria-controls]")];
  for (const sub of subs) {
    assert.equal(sub.getAttribute("role"), "group", sub.id + " is a group");
    const opener = openers.find((b) => b.getAttribute("aria-controls") === sub.id);
    assert.ok(opener, sub.id + " has an opener");
    assert.equal(sub.getAttribute("aria-label"), opener.textContent, sub.id + " is named after its opener");
  }
});

test("insights: every See card link names its program", async () => {
  const { document } = await loadPage("insights.html");
  await waitFor(() => document.querySelectorAll('a[href^="find.html#p-"]').length > 0);
  const links = [...document.querySelectorAll('a[href^="find.html#p-"]')];
  const names = new Set();
  for (const a of links) {
    const label = a.getAttribute("aria-label") || "";
    assert.match(label, /^See card: .{3,}/, a.outerHTML);
    assert.ok(a.textContent.trim() === "See card" && label.startsWith(a.textContent.trim()), "the visible text starts the name");
    names.add(label);
  }
  assert.equal(names.size, links.length, "no two See card links share a name");
});

test("younger: Official page links in the training and groups lists name what they open", async () => {
  const { document } = await loadPage("younger.html");
  await waitFor(() => document.querySelectorAll("#train a, #groups a").length > 0);
  const links = [...document.querySelectorAll("#train a, #groups a")].filter((a) => a.textContent.trim() === "Official page");
  assert.ok(links.length >= 4, "the lists have Official page links");
  const names = new Set();
  for (const a of links) {
    const label = a.getAttribute("aria-label") || "";
    assert.match(label, /^Official page: .{3,}/, a.outerHTML);
    names.add(label);
  }
  assert.equal(names.size, links.length, "no two Official page links share a name");
});
