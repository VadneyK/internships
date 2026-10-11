// A page's "Last read" stamp may not be older than the read date of any data JSON its script loads
// (ticket r2-accuracy-7). The r1 stamp test only checks dates inside one file.
// Map: src/<page>.html -> assets/js/<page>.js -> every data/<name>.json named there.
// Pages with no stamp, no script or no dated JSON are skipped.
// Run with: node --test tests/r4-accuracy-7-stamp-vs-json-read.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DATE = "(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\\d{1,2}), (\\d{4})";

const iso = (m) => `${m[3]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
const parseDate = (s) => {
  const m = typeof s === "string" && s.match(new RegExp(`^${DATE}$`));
  return m ? iso(m) : null;
};

// Every read date a JSON file carries: top-level "read" and each states.*.read.
function jsonReads(rel) {
  const d = JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
  const out = [];
  const top = parseDate(d.read);
  if (top) out.push({ where: "read", date: top });
  if (d.states && typeof d.states === "object") {
    for (const [k, v] of Object.entries(d.states)) {
      const x = parseDate(v && v.read);
      if (x) out.push({ where: `states.${k}.read`, date: x });
    }
  }
  return out;
}

const pages = fs.readdirSync(path.join(root, "src")).filter((f) => f.endsWith(".html")).sort();

for (const file of pages) {
  const page = file.replace(/\.html$/, "");
  const jsRel = `assets/js/${page}.js`;
  if (!fs.existsSync(path.join(root, jsRel))) continue;
  const html = fs.readFileSync(path.join(root, "src", file), "utf8");
  const sm = html.match(new RegExp(`Last read[^<]{0,80}?${DATE}`));
  if (!sm) continue;
  const stamp = iso([null, sm[1], sm[2], sm[3]]);
  const js = fs.readFileSync(path.join(root, jsRel), "utf8");
  const jsons = [...new Set([...js.matchAll(/data\/([A-Za-z0-9_-]+)\.json/g)].map((m) => `data/${m[1]}.json`))]
    .filter((rel) => fs.existsSync(path.join(root, rel)));

  test(`${file}: Last read stamp is not older than the JSON its script loads`, () => {
    const late = [];
    for (const rel of jsons) {
      for (const r of jsonReads(rel)) {
        if (r.date > stamp) late.push(`${file} stamp ${stamp} is older than ${rel} ${r.where} ${r.date}`);
      }
    }
    assert.deepEqual(late, [], `${file}: update the page stamp (loads ${jsons.join(", ") || "no dated json"})`);
  });
}

test("at least one page was checked", () => {
  assert.ok(pages.some((f) => fs.existsSync(path.join(root, `assets/js/${f.replace(/\.html$/, "")}.js`))));
});
