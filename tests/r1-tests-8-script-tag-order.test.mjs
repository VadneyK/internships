// Checks the script and stylesheet tags in every built root page (the *.html files at the repo root, made by tools/build.py).
// Rules, derived from home (index.html) and find.html, which both load: lib.js, then common.js, then the page script.
// Pages with `lib: none` in their src header skip lib.js, so for them the order is common.js, then the page script.
// Checks, per page and per tag:
//   - each local file exists, and no local script or stylesheet appears twice;
//   - common.js loads before every other page script, and lib.js (when present) loads before common.js;
//   - every external script has defer, or sits after the main or footer content and before </body>;
//   - a local script or stylesheet reference carries no query other than the single ?v= build value, and every page uses the same one.
// Failure messages name the page and the tag.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

function attr(tag, name) {
  const m = tag.match(new RegExp("\\s" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')", "i"));
  return m ? (m[1] !== undefined ? m[1] : m[2]) : null;
}

function isLocal(ref) {
  return ref !== null && ref !== "" && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref);
}

// Every script src and stylesheet href in document order, as { tag, kind, ref, index }.
function refsOf(html) {
  const out = [];
  const re = /<(script|link)\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const kind = m[1].toLowerCase();
    if (kind === "script") {
      const src = attr(tag, "src");
      if (src !== null) out.push({ tag, kind, ref: src, index: m.index, stylesheet: false });
    } else {
      const href = attr(tag, "href");
      const rel = (attr(tag, "rel") || "").toLowerCase();
      if (href !== null && isLocal(href)) out.push({ tag, kind, ref: href, index: m.index, stylesheet: rel.split(/\s+/).includes("stylesheet") });
    }
  }
  return out;
}

// The 404 page uses site-absolute paths under /internships/; other pages use relative paths. Both map to the repo root.
function splitRef(ref) {
  const q = ref.indexOf("?");
  let file = q === -1 ? ref : ref.slice(0, q);
  const query = q === -1 ? null : ref.slice(q + 1);
  file = file.replace(/^\/internships\//, "").replace(/^\/+/, "");
  return { file, query };
}

const BUILD_VALUES = new Set();

for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), "utf-8");
  const refs = refsOf(html);
  const scripts = refs.filter((r) => r.kind === "script");
  const sheets = refs.filter((r) => r.kind === "link" && r.stylesheet);
  const endOfContent = Math.max(html.lastIndexOf("</main>"), html.lastIndexOf("</footer>"));
  const bodyEnd = html.lastIndexOf("</body>");

  test(`${page}: local script and stylesheet files exist and none appears twice`, () => {
    const seen = new Map();
    for (const r of [...scripts, ...sheets]) {
      const { file } = splitRef(r.ref);
      assert.ok(fs.existsSync(path.join(ROOT, file)), `${page}: ${r.tag} points at missing file ${file}`);
      assert.ok(!seen.has(file), `${page}: ${file} is loaded twice (${seen.get(file)} and ${r.tag})`);
      seen.set(file, r.tag);
    }
  });

  test(`${page}: lib.js, then common.js, then page scripts`, () => {
    const names = scripts.map((r) => splitRef(r.ref).file.split("/").pop());
    assert.ok(names.includes("common.js"), `${page}: common.js is not loaded`);
    const common = names.indexOf("common.js");
    const lib = names.indexOf("lib.js");
    if (lib !== -1) assert.ok(lib < common, `${page}: lib.js must load before common.js (${scripts[lib].tag} comes after ${scripts[common].tag})`);
    names.forEach((n, i) => {
      if (n === "common.js" || n === "lib.js") return;
      assert.ok(i > common, `${page}: ${scripts[i].tag} must load after common.js`);
    });
  });

  test(`${page}: every external script has defer or sits at the end of body`, () => {
    for (const r of scripts) {
      if (/\sdefer(?:\s|=|>|\/)/i.test(r.tag)) continue;
      assert.ok(endOfContent !== -1 && r.index > endOfContent, `${page}: ${r.tag} has no defer and is not after the main or footer content`);
      assert.ok(bodyEnd !== -1 && r.index < bodyEnd, `${page}: ${r.tag} is not inside body`);
    }
  });

  test(`${page}: local script and stylesheet refs carry only the single ?v= build value`, () => {
    for (const r of refs) {
      const { query } = splitRef(r.ref);
      if (query === null) continue;
      assert.ok(/^v=[^&=]+$/.test(query), `${page}: ${r.tag} carries a query other than ?v= (${query})`);
      BUILD_VALUES.add(query);
    }
  });
}

test("all pages share one ?v= build value", () => {
  assert.ok(BUILD_VALUES.size <= 1, `more than one build value in use: ${[...BUILD_VALUES].join(", ")}`);
});
