import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

async function pick(page, st, age, kind) {
  const { window, document } = page;
  type(window, document.getElementById("pState"), st);
  type(window, document.getElementById("pAge"), age);
  type(window, document.getElementById("pKind"), kind);
}

test("permit jump link: California 15 with a paid job has a link to an open Get it done section", async () => {
  const p = await loadPage("permit.html"); await tick();
  await pick(p, "ca", "15", "job"); await tick();
  const link = p.document.querySelector("#pOut a[href='#packetSec']");
  assert.ok(link, "jump link present");
  assert.match(link.textContent, /Jump to: send a message to your school or print your checklist/);
  const target = p.document.getElementById("packetSec");
  assert.equal(target.hidden, false, "target section is not hidden");
  assert.ok(target.querySelector("h2"), "target has a heading");
});

test("permit jump link: an age that gives No permit has no jump link", async () => {
  const p = await loadPage("permit.html"); await tick();
  await pick(p, "ca", "18", "job"); await tick();
  assert.match(p.document.querySelector("#pOut .tag").textContent, /No permit/);
  assert.equal(p.document.querySelector("#pOut a[href='#packetSec']"), null);
});

test("permit jump link: clicking it moves focus to the Get it done heading", async () => {
  const p = await loadPage("permit.html"); await tick();
  await pick(p, "ca", "15", "job"); await tick();
  const link = p.document.querySelector("#pOut a[href='#packetSec']");
  link.dispatchEvent(new p.window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await tick();
  const heading = p.document.querySelector("#packetSec h2");
  assert.equal(heading.getAttribute("tabindex"), "-1");
  assert.equal(p.document.activeElement, heading);
  assert.match(heading.textContent, /Get it done/);
});

test("permit jump link: no link for too young, and no link before all three answers", async () => {
  const y = await loadPage("permit.html"); await tick();
  await pick(y, "ca", "12", "job"); await tick();
  assert.equal(y.document.querySelector("#pOut a[href='#packetSec']"), null);
  const b = await loadPage("permit.html"); await tick();
  await pick(b, "ca", "15", ""); await tick();
  assert.equal(b.document.querySelector("#pOut a[href='#packetSec']"), null);
});
