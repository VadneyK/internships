"""Tests for the polite, time-boxed link checker. No network: check, load_programs, time are mocked.
Run: python3 -m unittest discover -s tests -v"""
import contextlib
import io
import os
import sys
import threading
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
import proglib  # noqa: E402
import linkcheck  # noqa: E402


def programs_for(urls):
    return [("p%d.json" % i, {"id": "prog-%d" % i, "name": "Program %d" % i, "url": u, "apply_url": None})
            for i, u in enumerate(urls)]


class FakeClock:
    """A fake monotonic clock that only moves when sleep or a fake check moves it."""

    def __init__(self):
        self.now = 1000.0
        self.lock = threading.Lock()

    def monotonic(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


class BudgetTests(unittest.TestCase):
    def run_main(self, urls, check, flags=(), clock=None, week=1):
        clock = clock or FakeClock()
        out = io.StringIO()
        with mock.patch.object(linkcheck, "check", check), \
                mock.patch.object(proglib, "load_programs", lambda: programs_for(urls)), \
                mock.patch.object(linkcheck, "iso_week", lambda: week), \
                mock.patch.object(linkcheck.time, "monotonic", clock.monotonic), \
                mock.patch.object(linkcheck.time, "sleep", clock.sleep), \
                mock.patch.object(sys, "argv", ["linkcheck.py", "--workers", "1", *flags]), \
                contextlib.redirect_stdout(out):
            code = linkcheck.main()
        return code, out.getvalue()

    def test_same_host_urls_are_spaced_by_the_delay(self):
        clock = FakeClock()
        starts = []

        def check(url):
            starts.append(clock.now)
            return ("ok", 200)

        urls = ["https://a.example/%d" % i for i in range(4)]
        code, report = self.run_main(urls, check, ["--host-delay", "2.5"], clock)
        self.assertEqual(code, 0)
        gaps = [b - a for a, b in zip(starts, starts[1:])]
        self.assertEqual(len(starts), 4)
        self.assertTrue(all(g >= 2.5 for g in gaps), gaps)
        self.assertIn("4 links: 4 ok, 0 blocked, 0 broken, 0 not checked.", report)

    def test_same_host_never_runs_at_the_same_time(self):
        lock = threading.Lock()
        active = {}
        overlap = []
        gate = threading.Barrier(2, timeout=0.05)

        def check(url):
            host = linkcheck.host_of(url)
            with lock:
                active[host] = active.get(host, 0) + 1
                if active[host] > 1:
                    overlap.append(host)
            try:
                gate.wait()  # lets two different hosts meet; same-host calls would be serial
            except threading.BrokenBarrierError:
                pass
            with lock:
                active[host] -= 1
            return ("ok", 200)

        urls = ["https://a.example/1", "https://a.example/2", "https://b.example/1", "https://b.example/2"]
        out = io.StringIO()
        with mock.patch.object(linkcheck, "check", check), \
                mock.patch.object(proglib, "load_programs", lambda: programs_for(urls)), \
                mock.patch.object(sys, "argv", ["linkcheck.py", "--workers", "4", "--host-delay", "0"]), \
                contextlib.redirect_stdout(out):
            linkcheck.main()
        self.assertEqual(overlap, [])
        self.assertIn("4 ok", out.getvalue())

    def test_expired_budget_lists_the_rest_as_not_checked(self):
        clock = FakeClock()

        def check(url):
            clock.now += 60  # each request "takes" a minute
            return ("ok", 200)

        urls = ["https://h%d.example/" % i for i in range(5)]
        code, report = self.run_main(urls, check, ["--budget-minutes", "2", "--host-delay", "0"], clock)
        self.assertEqual(code, 0)
        self.assertIn("## Not checked (time budget ran out)", report)
        self.assertIn("5 links: 2 ok, 0 blocked, 0 broken, 3 not checked.", report)
        self.assertNotIn("## Broken", report)

    def test_zero_budget_checks_nothing(self):
        calls = []
        code, report = self.run_main(["https://a.example/1"], lambda u: calls.append(u) or ("ok", 200),
                                     ["--budget-minutes", "0"])
        self.assertEqual(calls, [])
        self.assertEqual(code, 0)
        self.assertIn("1 not checked", report)

    def test_two_timeouts_in_a_row_skip_the_rest_of_the_host(self):
        calls = []

        def check(url):
            calls.append(url)
            return ("blocked", "timeout")

        urls = ["https://slow.example/%d" % i for i in range(5)]
        code, report = self.run_main(urls, check, ["--host-delay", "0"])
        self.assertEqual(len(calls), 2)
        self.assertEqual(report.count("host not answering"), 3)
        self.assertIn("## Blocked", report)
        self.assertNotIn("## Broken", report)
        self.assertNotIn("## Not checked", report)

    def test_a_good_answer_resets_the_timeout_count(self):
        answers = iter([("blocked", "timeout"), ("ok", 200), ("blocked", "timeout"), ("ok", 200)])
        calls = []

        def check(url):
            calls.append(url)
            return next(answers)

        urls = ["https://a.example/%d" % i for i in range(4)]
        _, report = self.run_main(urls, check, ["--host-delay", "0"])
        self.assertEqual(len(calls), 4)
        self.assertNotIn("host not answering", report)

    def test_strict_exits_1_only_for_broken(self):
        urls = ["https://a.example/1", "https://b.example/1"]
        code, _ = self.run_main(urls, lambda u: ("ok", 200), ["--strict", "--budget-minutes", "0"])
        self.assertEqual(code, 0)  # everything not checked
        code, _ = self.run_main(urls, lambda u: ("blocked", 403), ["--strict"])
        self.assertEqual(code, 0)
        code, report = self.run_main(urls, lambda u: ("broken", 404) if "b.example" in u else ("ok", 200), ["--strict"])
        self.assertEqual(code, 1)
        self.assertIn("## Broken", report)

    def test_biggest_hosts_first_and_rotation_by_week(self):
        groups = {"big.example": ["1", "2", "3"], "a.example": ["x"], "b.example": ["y"], "c.example": ["z"]}
        self.assertEqual(linkcheck.order_hosts(groups, 0), ["big.example", "a.example", "b.example", "c.example"])
        self.assertEqual(linkcheck.order_hosts(groups, 1), ["big.example", "b.example", "c.example", "a.example"])
        self.assertEqual(linkcheck.order_hosts(groups, 3), ["big.example", "a.example", "b.example", "c.example"])

    def test_timeout_flag_reaches_fetch(self):
        seen = []

        class Resp:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        def fake_urlopen(req, timeout=None, context=None):
            seen.append(timeout)
            return Resp()

        old = linkcheck.TIMEOUT
        try:
            linkcheck.TIMEOUT = 7
            with mock.patch.object(linkcheck.urllib.request, "urlopen", fake_urlopen):
                linkcheck.fetch("https://a.example/", "HEAD")
        finally:
            linkcheck.TIMEOUT = old
        self.assertEqual(seen, [7])
        self.assertEqual(linkcheck.TIMEOUT, 15)


class FieldsAndAuxTests(unittest.TestCase):
    def run_main(self, programs, flags=(), aux=None, results=None):
        seen = []

        def check(url):
            seen.append(url)
            return (results or {}).get(url, ("ok", 200))

        out = io.StringIO()
        with mock.patch.object(linkcheck, "check", check), \
                mock.patch.object(proglib, "load_programs", lambda: [("p.json", d) for d in programs]), \
                mock.patch.object(linkcheck, "aux_links", lambda: aux or {}), \
                mock.patch.object(sys, "argv", ["linkcheck.py", "--workers", "1", "--host-delay", "0", *flags]), \
                contextlib.redirect_stdout(out):
            code = linkcheck.main()
        return code, out.getvalue(), seen

    PROG = {"id": "prog-1", "name": "P", "url": "https://a.example/u", "apply_url": "https://a.example/apply",
            "sources_fetched": ["https://s.example/1", "https://s.example/2"]}

    def test_default_checks_only_url_and_apply_url(self):
        code, report, seen = self.run_main([self.PROG], aux={"https://x.example/": ["money.json"]})
        self.assertEqual(sorted(seen), ["https://a.example/apply", "https://a.example/u"])
        self.assertIn("2 links:", report)

    def test_fields_can_add_sources_fetched(self):
        code, report, seen = self.run_main([self.PROG], ["--fields", "url,apply_url,sources_fetched"])
        self.assertEqual(len(seen), 4)
        self.assertIn("https://s.example/2", seen)

    def test_broken_source_has_its_own_section(self):
        code, report, _ = self.run_main(
            [self.PROG], ["--fields", "url,sources_fetched", "--strict"],
            results={"https://s.example/1": ("broken", 404), "https://a.example/u": ("broken", 410)})
        self.assertEqual(code, 1)
        self.assertIn("## Broken\n", report)
        self.assertIn("## Broken sources", report)
        sources = report.split("## Broken sources", 1)[1]
        self.assertIn("https://s.example/1  (404) used by `prog-1`", sources)
        self.assertNotIn("https://a.example/u", sources)
        self.assertNotIn("https://s.example/1", report.split("## Broken sources", 1)[0])

    def test_aux_links_are_checked_and_reported_apart(self):
        aux = {"https://x.example/rule": ["permits.json", "money.json"]}
        code, report, seen = self.run_main(
            [self.PROG], ["--aux", "--strict"], aux=aux, results={"https://x.example/rule": ("broken", 404)})
        self.assertIn("https://x.example/rule", seen)
        self.assertEqual(code, 1)
        self.assertIn("## Broken aux links", report)
        self.assertNotIn("## Broken\n", report)
        self.assertIn("used by `permits.json`, `money.json`", report)

    def test_no_aux_flag_means_no_aux_section(self):
        _, report, _ = self.run_main([self.PROG], aux={"https://x.example/": ["money.json"]},
                                     results={"https://x.example/": ("broken", 404)})
        self.assertNotIn("aux", report)

    def test_empty_fields_is_a_usage_error(self):
        with self.assertRaises(SystemExit), contextlib.redirect_stderr(io.StringIO()):
            self.run_main([self.PROG], ["--fields", ","])

    def test_aux_links_reads_https_links_from_nested_json(self):
        import json
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "money.json"), "w", encoding="utf-8") as f:
                json.dump({"a": [{"url": "https://m.example/x"}, "See https://m.example/y."],
                           "b": "http://insecure.example/", "c": 5}, f)
            with open(os.path.join(d, "safety.json"), "w", encoding="utf-8") as f:
                json.dump(["https://m.example/x"], f)
            found = linkcheck.aux_links(d, ("money.json", "safety.json", "missing.json"))
        self.assertEqual(found, {"https://m.example/x": ["money.json", "safety.json"],
                                 "https://m.example/y": ["money.json"]})

    def test_real_aux_files_yield_links(self):
        found = linkcheck.aux_links()
        self.assertGreater(len(found), 50)
        self.assertTrue(all(u.startswith("https://") for u in found))

    def test_help_lists_both_flags(self):
        out = io.StringIO()
        with mock.patch.object(sys, "argv", ["linkcheck.py", "--help"]), \
                contextlib.redirect_stdout(out), self.assertRaises(SystemExit):
            linkcheck.main()
        self.assertIn("--fields", out.getvalue())
        self.assertIn("--aux", out.getvalue())


if __name__ == "__main__":
    unittest.main()
