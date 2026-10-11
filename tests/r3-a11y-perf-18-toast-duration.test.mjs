// Ticket r3-a11y-perf-18: the toast stays up long enough to read.
// Hold time = max(4000 ms, 60 ms per character), capped at 9000 ms. A manual clock replaces the page's
// setTimeout and clearTimeout, so the checks run at exact times without waiting in real time.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function manualClock(window) {
  let now = 0, nextId = 1;
  let timers = [];
  window.setTimeout = (fn, ms) => { const t = { at: now + (Number(ms) || 0), fn, id: nextId++ }; timers.push(t); return t.id; };
  window.clearTimeout = (id) => { timers = timers.filter((t) => t.id !== id); };
  return {
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        now = due.at;
        timers = timers.filter((t) => t !== due);
        due.fn();
      }
      now = end;
    },
  };
}

async function setup() {
  const { window, document, errors } = await loadPage("about.html");
  await tick(50);
  const toast = document.getElementById("toast");
  assert.ok(toast, "about.html has a #toast element");
  const clock = manualClock(window);
  return { window, toast, clock, errors };
}

test("a short message stays up at 3.9 s and is gone just after 4 s", async () => {
  const { window, toast, clock, errors } = await setup();
  window.TIG.toast("Copied");
  clock.advance(3900);
  assert.equal(toast.classList.contains("show"), true, "still shown at 3900 ms");
  assert.equal(toast.textContent, "Copied", "text still there at 3900 ms");
  clock.advance(200);
  assert.equal(toast.classList.contains("show"), false, "hidden after 4100 ms");
  assert.equal(toast.textContent, "", "text cleared after 4100 ms");
  assert.deepEqual(errors, []);
});

test("a 120-character message is shown at 4 s and gone by 9 s", async () => {
  const { window, toast, clock, errors } = await setup();
  const msg = "x".repeat(120);
  assert.equal(msg.length, 120);
  window.TIG.toast(msg);
  clock.advance(4000);
  assert.equal(toast.classList.contains("show"), true, "still shown at 4000 ms");
  assert.equal(toast.textContent, msg, "text still there at 4000 ms");
  clock.advance(5000);
  assert.equal(toast.classList.contains("show"), false, "hidden by 9000 ms");
  assert.equal(toast.textContent, "", "text cleared by 9000 ms");
  assert.deepEqual(errors, []);
});

test("the hold time is capped at 9 s for a very long message", async () => {
  const { window, toast, clock, errors } = await setup();
  window.TIG.toast("y".repeat(400));
  clock.advance(8900);
  assert.equal(toast.classList.contains("show"), true, "still shown at 8900 ms");
  clock.advance(100);
  assert.equal(toast.classList.contains("show"), false, "hidden at 9000 ms");
  assert.deepEqual(errors, []);
});

test("a second call restarts the hold time, and the same text still re-announces", async () => {
  const { window, toast, clock, errors } = await setup();
  const seen = [];
  const observer = new window.MutationObserver(() => {
    if (seen[seen.length - 1] !== toast.textContent) seen.push(toast.textContent);
  });
  observer.observe(toast, { childList: true, characterData: true, subtree: true });
  window.TIG.toast("Copied");
  clock.advance(3000);
  window.TIG.toast("Copied");
  // the repeat goes empty first; the observer reads it on the next microtask, before the 30 ms restore
  await Promise.resolve();
  await tick(5);
  clock.advance(30);
  await tick(5);
  assert.ok(seen.includes(""), "text went empty for the repeat: " + JSON.stringify(seen));
  assert.equal(toast.textContent, "Copied");
  clock.advance(3900);
  assert.equal(toast.classList.contains("show"), true, "still shown 3.9 s after the second call");
  clock.advance(200);
  assert.equal(toast.classList.contains("show"), false, "hidden 4 s after the second call");
  observer.disconnect();
  assert.deepEqual(errors, []);
});

test("source check: no other script sets its own timer to hide the toast", () => {
  const dir = path.join(ROOT, "assets", "js");
  const offenders = [];
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".js"))) {
    if (f === "common.js") continue;
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    if (/classList\.remove\(\s*["']show["']\s*\)/.test(src) && /toast/i.test(src)) offenders.push(f);
    for (const line of src.split("\n")) {
      if (/toast/i.test(line) && /setTimeout\s*\(/.test(line)) offenders.push(f + ": " + line.trim());
    }
  }
  assert.deepEqual(offenders, [], "only common.js may time the toast");
  const common = fs.readFileSync(path.join(dir, "common.js"), "utf8");
  assert.match(common, /Math\.max\(4000,\s*60\s*\*\s*String\(msg\)\.length\)/, "common.js holds the 4000 ms minimum and 60 ms per character");
  assert.match(common, /Math\.min\(9000,/, "common.js caps the hold at 9000 ms");
});
