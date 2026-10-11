// r1-accuracy-11: any dollar amount in the bank.items list of data/money.json
// must have a fdic.gov source in bank.src. The custodial account deposit
// insurance line was removed because no listed source supported its $250,000
// figure, so this guards against an unsourced amount coming back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const money = JSON.parse(readFileSync(join(root, "data/money.json"), "utf8"));

const DOLLAR_AMOUNT = /\$\d/;

test("bank.items: any dollar amount needs an fdic.gov source in bank.src", () => {
  const items = money.bank.items;
  const hasAmount = items.some((x) => DOLLAR_AMOUNT.test(x));
  if (!hasAmount) return;
  const srcs = money.bank.src || [];
  const hasFdic = srcs.some((s) => {
    try {
      return new URL(s.u).hostname === "fdic.gov" || new URL(s.u).hostname.endsWith(".fdic.gov");
    } catch {
      return false;
    }
  });
  assert.ok(hasFdic, "bank.items has a dollar amount but bank.src has no fdic.gov URL");
});

test("bank.items no longer carries the unsourced deposit insurance line", () => {
  const joined = money.bank.items.join("\n");
  assert.ok(!joined.includes("deposit insurance"), "unsourced deposit insurance line is still present");
});
