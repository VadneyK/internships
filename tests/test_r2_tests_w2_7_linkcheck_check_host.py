"""Unit tests for linkcheck.check_host: host-down, deadline and delay rules.
No network and no real sleeping: check, time.sleep and time.monotonic are faked.
Run: python3 -m unittest discover -s tests -v"""
import os
import sys
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
import linkcheck  # noqa: E402

OK = ("ok", "200")
TIMEOUT = linkcheck.TIMEOUT_RESULT
URLS = ["https://h.example/%d" % i for i in range(6)]


class Harness:
    """Fake clock that moves only when sleep is called, plus a scripted check()."""

    def __init__(self, script, start=100.0):
        self.now = start
        self.sleeps = []
        self.checked = []
        self.script = list(script)

    def monotonic(self):
        return self.now

    def sleep(self, secs):
        self.sleeps.append(secs)
        self.now += secs

    def check(self, url):
        self.checked.append(url)
        return self.script.pop(0) if self.script else OK

    def run(self, urls, deadline, delay):
        results = {}
        with mock.patch.object(linkcheck, "check", self.check), \
                mock.patch.object(linkcheck.time, "sleep", self.sleep), \
                mock.patch.object(linkcheck.time, "monotonic", self.monotonic):
            linkcheck.check_host(urls, results, deadline, delay)
        return results


class CheckHostTests(unittest.TestCase):
    def test_two_timeouts_mark_rest_host_down_without_checking(self):
        h = Harness([TIMEOUT, TIMEOUT])
        res = h.run(URLS, 1000.0, 0)
        self.assertEqual(h.checked, URLS[:2])
        self.assertEqual(res[URLS[0]], TIMEOUT)
        self.assertEqual(res[URLS[1]], TIMEOUT)
        for u in URLS[2:]:
            self.assertEqual(res[u], linkcheck.HOST_DOWN)

    def test_timeout_good_timeout_does_not_trip(self):
        h = Harness([TIMEOUT, OK, TIMEOUT, OK, OK, OK])
        res = h.run(URLS, 1000.0, 0)
        self.assertEqual(h.checked, URLS)
        self.assertNotIn(linkcheck.HOST_DOWN, res.values())

    def test_deadline_already_passed_writes_nothing(self):
        h = Harness([])
        res = h.run(URLS, 100.0, 1.0)
        self.assertEqual(res, {})
        self.assertEqual(h.checked, [])
        self.assertEqual(h.sleeps, [])

    def test_deadline_reached_mid_list_leaves_later_urls_out(self):
        h = Harness([])
        orig = h.check

        def check_and_advance(url):
            r = orig(url)
            h.now += 10  # each request takes 10 seconds
            return r

        h.check = check_and_advance
        res = h.run(URLS, 125.0, 0)  # checks at t=100, 110, 120, then 130 >= deadline
        self.assertEqual(sorted(res), sorted(URLS[:3]))
        self.assertEqual(h.checked, URLS[:3])

    def test_zero_delay_never_sleeps(self):
        h = Harness([])
        h.run(URLS, 1000.0, 0)
        self.assertEqual(h.sleeps, [])

    def test_delay_sleeps_between_urls_not_before_first(self):
        h = Harness([])
        h.run(URLS[:3], 1000.0, 2.5)
        self.assertEqual(h.sleeps, [2.5, 2.5])

    def test_sleep_never_longer_than_time_left(self):
        h = Harness([])
        res = h.run(URLS[:3], 101.0, 5.0)  # 1 second left when the first sleep starts
        self.assertEqual(h.sleeps, [1.0])
        self.assertEqual(list(res), [URLS[0]])  # deadline hit after the short sleep
        self.assertEqual(h.checked, [URLS[0]])

    def test_one_result_per_url_reached(self):
        h = Harness([TIMEOUT, TIMEOUT])
        res = h.run(URLS, 1000.0, 1.0)
        self.assertEqual(len(res), len(URLS))
        self.assertEqual(set(res), set(URLS))
        h2 = Harness([])
        res2 = h2.run(URLS + [URLS[0]], 1000.0, 0)  # repeats collapse in a dict; checked once per visit
        self.assertEqual(len(h2.checked), len(URLS) + 1)
        self.assertEqual(len(res2), len(URLS))


if __name__ == "__main__":
    unittest.main()
