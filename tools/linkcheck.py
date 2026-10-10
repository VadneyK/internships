#!/usr/bin/env python3
"""Check that every program link still works. Writes a Markdown report.

  python3 tools/linkcheck.py                 check everything, print the report
  python3 tools/linkcheck.py --out report.md --strict   exit 1 if any link is broken

Classification:
  ok       2xx or 3xx
  blocked  any other 4xx (403, 405, 429, 999...) or a bot wall: the site refuses scripts, so check by hand (not a failure)
  broken   404, 410, DNS failure, certificate error, or 5xx twice in a row

Politeness and limits:
  Each host is visited by one thread at a time, with --host-delay seconds between requests to it.
  Different hosts run in parallel. If a host times out twice in a row, its remaining links are marked
  blocked ("host not answering") without more requests. When --budget-minutes runs out, no new
  request starts; the links never reached are listed as "not checked". That is not a failure.
"""
import argparse
import concurrent.futures as cf
import datetime
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import proglib

UA = "Mozilla/5.0 (compatible; TeenInternshipGuideLinkCheck/1.0; +https://github.com/VadneyK/internships)"


TIMEOUT = 15  # seconds per request; main() sets it from --timeout
HOST_DOWN = ("blocked", "host not answering")
TIMEOUT_RESULT = ("blocked", "timeout")


def fetch(url, method):
    req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as r:
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


def iso_week():
    return datetime.date.today().isocalendar()[1]


def host_of(url):
    return urllib.parse.urlparse(url).netloc.lower()


def order_hosts(groups, week):
    """Hosts with the most URLs first. Inside each group of hosts that hold the same number of URLs,
    rotate by the ISO week so the same hosts are not always the ones cut off when time runs out."""
    by_size = {}
    for host in sorted(groups):
        by_size.setdefault(len(groups[host]), []).append(host)
    ordered = []
    for size in sorted(by_size, reverse=True):
        hosts = by_size[size]
        shift = week % len(hosts)
        ordered += hosts[shift:] + hosts[:shift]
    return ordered


def check_host(urls, results, deadline, delay):
    """Check one host's URLs one after another. Writes into results; URLs never reached are left out."""
    timeouts_in_a_row = 0
    for n, url in enumerate(urls):
        if time.monotonic() >= deadline:
            return
        if timeouts_in_a_row >= 2:
            results[url] = HOST_DOWN
            continue
        if n and delay > 0:
            time.sleep(max(0.0, min(delay, deadline - time.monotonic())))
            if time.monotonic() >= deadline:
                return
        result = check(url)
        results[url] = result
        timeouts_in_a_row = timeouts_in_a_row + 1 if result == TIMEOUT_RESULT else 0


def main():
    global TIMEOUT
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--workers", type=int, default=16, help="hosts checked in parallel")
    ap.add_argument("--timeout", type=float, default=15, help="seconds to wait for one request")
    ap.add_argument("--budget-minutes", type=float, default=40, help="stop starting new requests after this long")
    ap.add_argument("--host-delay", type=float, default=1.0, help="seconds between requests to the same host")
    args = ap.parse_args()
    TIMEOUT = args.timeout
    deadline = time.monotonic() + args.budget_minutes * 60

    programs = [d for _, d in proglib.load_programs()]
    jobs = {}
    for d in programs:
        for key in ("url", "apply_url"):
            if d.get(key):
                jobs.setdefault(d[key], []).append((d["id"], d["name"]))
    groups = {}
    for u in jobs:
        groups.setdefault(host_of(u), []).append(u)
    results = {}
    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(check_host, groups[h], results, deadline, args.host_delay)
                for h in order_hosts(groups, iso_week())]
        for f in futs:
            f.result()

    broken = {u: r for u, r in results.items() if r[0] == "broken"}
    blocked = {u: r for u, r in results.items() if r[0] == "blocked"}
    not_checked = sorted(u for u in jobs if u not in results)
    ok = len(results) - len(broken) - len(blocked)
    lines = ["# Link check", "", "%d links: %d ok, %d blocked, %d broken, %d not checked." % (
        len(jobs), ok, len(blocked), len(broken), len(not_checked)), ""]
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
    if not_checked:
        lines += ["## Not checked (time budget ran out)", "",
                  "These links were not tried this week. They are not counted as broken.", ""]
        for u in not_checked:
            who = ", ".join("`%s`" % i for i, _ in jobs[u])
            lines.append("- %s  used by %s" % (u, who))
        lines.append("")
    report = "\n".join(lines)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(report + "\n")
    print(report)
    return 1 if (args.strict and broken) else 0


if __name__ == "__main__":
    sys.exit(main())
