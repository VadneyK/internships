// Full storage: reads work, but every localStorage write throws QuotaExceededError.
// Every built page must keep working: no window error or unhandled rejection, typed text stays in the field,
// checkboxes and aria-pressed buttons still change, and the h1 and nav stay on the page.
// The screen after the same clicks must match the screen with normal storage (the page's own rules, such as a
// preset wage that replaces what was typed, still apply). Also: when removeItem throws, the Clear and
// Start over buttons do not break the page.
// Run with: node --test tests/r3-tests-6-storage-full.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

// Counts the writes and removals that the overrides rejected, across all pages.
const hits = { setItem: 0, removeItem: 0 };

// Storage is full: reads still work, writes throw the error a full phone storage throws.
function fullStorage(w, events) {
  w.Storage.prototype.setItem = function () {
    hits.setItem++;
    throw new w.DOMException("The quota has been exceeded.", "QuotaExceededError");
  };
  watchErrors(w, events);
}

// removeItem throws (storage blocked for removals only).
function noRemove(w, events) {
  w.Storage.prototype.removeItem = function () {
    hits.removeItem++;
    throw new w.DOMException("Storage access denied.", "SecurityError");
  };
  watchErrors(w, events);
}

// Normal storage: the baseline the full-storage run is compared with.
function normalStorage(w, events) {
  watchErrors(w, events);
}

function watchErrors(w, events) {
  w.addEventListener("error", (e) => events.push("window error: " + String((e.error && e.error.message) || e.message)));
  w.addEventListener("unhandledrejection", (e) => events.push("unhandled rejection: " + String((e.reason && e.reason.message) || e.reason)));
  // Dialogs and navigation never leave the test page.
  w.confirm = () => true;
  w.alert = () => {};
  w.prompt = () => "Sam";
  w.open = () => null;
  w.HTMLAnchorElement.prototype.click = function () {};
  w.HTMLFormElement.prototype.submit = function () {};
}

// A control the teen could see and use (not hidden, not in a closed details, not disabled or read only).
function shown(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    if (n.hidden || n.getAttribute("aria-hidden") === "true" || n.style.display === "none" || n.style.visibility === "hidden") return false;
    if (n.tagName === "DETAILS" && !n.open && !(el.tagName === "SUMMARY" && el.parentElement === n)) return false;
  }
  return !el.disabled && !el.readOnly;
}

const TEXT_SEL = "textarea, input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset]):not([type=file]):not([type=hidden]):not([type=range]):not([type=color])";

// A test value for each input type, so the browser keeps it as typed.
function sampleFor(el) {
  switch ((el.getAttribute("type") || "text").toLowerCase()) {
    case "number": return "12";
    case "date": return "2026-10-10";
    case "time": return "09:30";
    case "month": return "2026-10";
    case "email": return "sam.test@example.org";
    case "url": return "https://example.org/";
    case "tel": return "5550100";
    default: return "Sam test 12";
  }
}

const label = (el) => (el.id ? "#" + el.id : el.tagName.toLowerCase()) + (el.name ? "[name=" + el.name + "]" : "");

// Drive the page the same way every time: type, select, toggle checkboxes, press aria-pressed buttons.
// Returns the screen state at the end. Records the errors and the immediate checks it saw on the way.
async function drive(file, setup) {
  const events = [];
  const p = await loadPage(file, { setup: (w) => setup(w, events) });
  const { window: w, document: doc } = p;
  const immediate = []; // problems seen right after an action
  try {
    // 1. Every text input and textarea: type, the value must be there right after.
    for (const el of [...doc.querySelectorAll(TEXT_SEL)].filter(shown)) {
      const value = sampleFor(el);
      type(w, el, value);
      if (el.value !== value) immediate.push(`${label(el)} lost the typed text right after typing (${JSON.stringify(el.value)})`);
    }
    await tick(20);

    // 2. Every select: change to the last option.
    for (const el of [...doc.querySelectorAll("select")].filter(shown)) {
      if (el.options.length < 2) continue;
      el.selectedIndex = el.options.length - 1;
      el.dispatchEvent(new w.Event("change", { bubbles: true }));
      if (el.value !== el.options[el.options.length - 1].value) immediate.push(`${label(el)} did not keep the chosen option`);
    }
    await tick(20);

    // 3. Every checkbox: toggle, the checked state must flip.
    for (const el of [...doc.querySelectorAll("input[type=checkbox]")].filter(shown)) {
      const before = el.checked;
      el.click();
      if (el.checked === before) immediate.push(`${label(el)} checkbox did not flip`);
    }
    await tick(20);

    // 4. Every button with aria-pressed. A button that is off turns on. A button that is already on
    //    (the chosen view or tab) stays on when pressed again, so it must not turn off.
    for (const el of [...doc.querySelectorAll("button[aria-pressed]")].filter(shown)) {
      const before = el.getAttribute("aria-pressed");
      el.click();
      if (!el.isConnected) continue; // a re-render replaced it; the checks below still apply
      const after = el.getAttribute("aria-pressed");
      if (before === "false" && after !== "true") immediate.push(`${label(el)} aria-pressed did not flip from false`);
      if (before === "true" && after !== "true") immediate.push(`${label(el)} aria-pressed dropped from true`);
    }
    await tick(20);

    // 5. Later steps can change a field by design (a preset wage replaces a typed one), so the end state of
    //    every field is compared with the normal-storage run below, not with the typed value.
    // Compared by id only: cards and lists rebuild from the saved data, so their order and count can differ.
    const fields = {};
    for (const el of doc.querySelectorAll("input, select, textarea, button[aria-pressed]")) {
      if (!el.id) continue;
      if (el.type === "checkbox") fields["#" + el.id] = el.checked;
      else if (el.hasAttribute("aria-pressed")) fields["#" + el.id] = el.getAttribute("aria-pressed");
      else fields["#" + el.id] = el.value;
    }

    return {
      pageErrors: p.errors.slice(),
      events: events.slice(),
      immediate,
      fields,
      structure: [doc.querySelectorAll("h1").length < 1 && "no h1", !doc.querySelector("nav") && "no nav"].filter(Boolean),
      h1: (doc.querySelector("h1") || {}).textContent || "",
    };
  } finally {
    w.close();
  }
}

for (const file of PAGES) {
  test(`${file}: a full storage keeps typed text, toggles and the page itself`, async () => {
    const normal = await drive(file, normalStorage);
    const full = await drive(file, fullStorage);
    assert.deepEqual(full.pageErrors, [], `${file}: page errors with full storage`);
    assert.deepEqual(full.events, [], `${file}: window errors or unhandled rejections with full storage`);
    assert.deepEqual(full.immediate, [], `${file}: problems with full storage`);
    assert.deepEqual(full.structure, [], `${file}: page structure lost with full storage`);
    assert.ok(full.h1.trim(), `${file}: empty h1 with full storage`);
    assert.deepEqual(full.fields, normal.fields, `${file}: the screen with full storage differs from normal storage`);
  });

  test(`${file}: Clear and Start over still work when removeItem throws`, async () => {
    const events = [];
    const p = await loadPage(file, { setup: (w) => noRemove(w, events) });
    const { window: w, document: doc } = p;
    try {
      const buttons = [...doc.querySelectorAll("button")].filter((el) => shown(el) && /^\s*(clear|start over)/i.test(el.textContent || ""));
      for (const el of buttons) el.click();
      await tick(20);
      assert.deepEqual(p.errors, [], `${file}: page errors after Clear or Start over`);
      assert.deepEqual(events, [], `${file}: window errors or unhandled rejections after Clear or Start over`);
      assert.ok(doc.querySelector("h1"), `${file}: h1 lost after Clear or Start over`);
      assert.ok(doc.querySelector("nav"), `${file}: nav lost after Clear or Start over`);
    } finally {
      w.close();
    }
  });
}

test("the storage overrides were reached, so the tests above are not empty", () => {
  assert.ok(hits.setItem > 0, "no page called setItem while it was overridden");
  assert.ok(hits.removeItem > 0, "no page called removeItem while it was overridden");
});
