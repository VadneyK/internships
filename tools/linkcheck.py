#!/usr/bin/env python3
"""Check that every program link still works. Writes a Markdown report.

  python3 tools/linkcheck.py                 check everything, print the report
  python3 tools/linkcheck.py --out report.md --strict   exit 1 if any link is broken

Classification:
  ok       2xx or 3xx
  blocked  any other 4xx (403, 405, 429, 999...) or a bot wall: the site refuses scripts, so check by hand (not a failure)
  broken   404, 410, DNS failure, certificate error, or 5xx twice in a row
"""
import argparse
import concurrent.futures as cf
import ssl
import sys
import urllib.error
import urllib.request

import proglib

UA = "Mozilla/5.0 (compatible; TeenInternshipGuideLinkCheck/1.0; +https://github.com/VadneyK/internships)"


def fetch(url, method):
    req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=25, context=ctx) as r:
        return r.status


def check(url):
    last = None
    for attempt in range(2):
        for method in ("HEAD", "GET"):
            try:
                code = fetch(url, method)
                return ("ok", code)
            except urllib.error.HTTPError as e:
                last = e.code
                if method == "HEAD" and e.code in (403, 404, 405, 410, 501):
                    continue  # many servers answer HEAD badly; confirm with GET before judging
                if e.code in (404, 410):
                    return ("broken", e.code)
                if method == "GET" and e.code < 500 or e.code in (403, 429, 999):
                    return ("blocked", e.code)  # the site refuses scripts; a person should check in a browser
            except (urllib.error.URLError, ssl.SSLError, TimeoutError, ConnectionError) as e:
                reason = getattr(e, "reason", e)
                last = str(reason)[:80]
                if "timed out" in str(reason).lower():
                    return ("blocked", "timeout")
            except Exception as e:  # noqa: BLE001
                last = type(e).__name__
        # loop again once for transient errors
    return ("broken", last)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()

    programs = [d for _, d in proglib.load_programs()]
    jobs = {}
    for d in programs:
        for key in ("url", "apply_url"):
            if d.get(key):
                jobs.setdefault(d[key], []).append((d["id"], d["name"]))
    results = {}
    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(check, u): u for u in jobs}
        for f in cf.as_completed(futs):
            results[futs[f]] = f.result()

    broken = {u: r for u, r in results.items() if r[0] == "broken"}
    blocked = {u: r for u, r in results.items() if r[0] == "blocked"}
    lines = ["# Link check", "", "%d links checked: %d ok, %d blocked (check by hand), %d broken." % (
        len(results), len(results) - len(broken) - len(blocked), len(blocked), len(broken)), ""]
    if broken:
        lines += ["## Broken", ""]
        for u, (_, why) in sorted(broken.items()):
            who = ", ".join("`%s`" % i for i, _ in jobs[u])
            lines.append("- [ ] %s  (%s) used by %s" % (u, why, who))
        lines.append("")
    if blocked:
        lines += ["## Blocked or slow (open in a browser to confirm)", ""]
        for u, (_, why) in sorted(blocked.items()):
            who = ", ".join("`%s`" % i for i, _ in jobs[u])
            lines.append("- %s  (%s) used by %s" % (u, why, who))
        lines.append("")
    report = "\n".join(lines)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(report + "\n")
    print(report)
    return 1 if (args.strict and broken) else 0


if __name__ == "__main__":
    sys.exit(main())
