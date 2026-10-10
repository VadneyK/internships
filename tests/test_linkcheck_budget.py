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


if __name__ == "__main__":
    unittest.main()
