// Ticket: the short permit card's "Who to ask" cell. Four who and phone combinations, exact text.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const WHO = "Alaska Department of Labor and Workforce Development, Wage and Hour Administration.";
const PHONE = "(860) 263-6000";
const TEL = '<a href="tel:+18602636000">(860) 263-6000</a>';
const NOWHO = "Not listed on the page we read. Call the state labor department.";
const text = (html) => html.replace(/<[^>]+>/g, "");

test("who to ask: name and phone", () => {
  assert.equal(L.whoToAskHtml(WHO, PHONE, NOWHO), WHO + " " + TEL);
  assert.equal(text(L.whoToAskHtml(WHO, PHONE, NOWHO)), WHO + " " + PHONE);
});

test("who to ask: name only, no phone line", () => {
  assert.equal(L.whoToAskHtml(WHO, "", NOWHO), WHO);
  assert.equal(text(L.whoToAskHtml(WHO, "", NOWHO)), WHO);
  assert.doesNotMatch(L.whoToAskHtml(WHO, "", NOWHO), /Phone|Not listed/);
});

test("who to ask: phone only, labeled", () => {
  assert.equal(L.whoToAskHtml("", PHONE, NOWHO), "Phone: " + TEL);
  assert.equal(text(L.whoToAskHtml("", PHONE, NOWHO)), "Phone: " + PHONE);
});

test("who to ask: neither, the fallback sentence once", () => {
  assert.equal(L.whoToAskHtml("", "", NOWHO), NOWHO);
  assert.equal(text(L.whoToAskHtml("", "", NOWHO)), "Not listed on the page we read. Call the state labor department.");
});
