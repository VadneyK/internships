"""2026-10-15: the link checker reported about 15 false "broken" links on 2026-10-15: spaces in a URL (InvalidURL),
incomplete certificate chains that browsers repair themselves, and Microsoft Forms answering every script with 503.
No network: fetch is faked. Run: python3 -m unittest tests.test_linkcheck_false_alarms -v"""
import os
import ssl
import sys
import unittest
import urllib.error
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
import linkcheck  # noqa: E402


def raising(exc):
    def fake(url, method):
        raise exc
    return fake


class BrowserUrl(unittest.TestCase):
    def test_spaces_are_encoded_and_existing_escapes_kept(self):
        self.assertEqual(linkcheck.browser_url("https://www.purdue.edu/a/Short-Term Courses.php"),
                         "https://www.purdue.edu/a/Short-Term%20Courses.php")
        self.assertEqual(linkcheck.browser_url("https://a.example/x%20y?q=a b&r=1#f"), "https://a.example/x%20y?q=a%20b&r=1#f")
        self.assertEqual(linkcheck.browser_url("https://a.example/p?x=1&y=(2)"), "https://a.example/p?x=1&y=(2)")

    def test_fetch_sends_the_encoded_url(self):
        seen = []

        class Resp:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *a): return False

        def fake_urlopen(req, timeout, context):
            seen.append(req.full_url)
            return Resp()
        with mock.patch.object(linkcheck.urllib.request, "urlopen", fake_urlopen):
            self.assertEqual(linkcheck.check("https://x.example/a b.php"), ("ok", 200))
        self.assertEqual(seen, ["https://x.example/a%20b.php"])


class CertificateChain(unittest.TestCase):
    def test_incomplete_chain_is_blocked_not_broken(self):
        err = urllib.error.URLError(ssl.SSLCertVerificationError(1, "[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate"))
        with mock.patch.object(linkcheck, "fetch", raising(err)):
            self.assertEqual(linkcheck.check("https://museum.example/volunteer"), linkcheck.CHAIN_INCOMPLETE)

    def test_hostname_mismatch_is_still_broken(self):
        err = urllib.error.URLError(ssl.SSLCertVerificationError(1, "[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: Hostname mismatch"))
        with mock.patch.object(linkcheck, "fetch", raising(err)):
            self.assertEqual(linkcheck.check("https://foodbank.example/volunteer")[0], "broken")


class BotWall(unittest.TestCase):
    def test_microsoft_forms_503_is_blocked(self):
        err = urllib.error.HTTPError("https://forms.office.com/g/abc", 503, "Service Unavailable", {}, None)
        with mock.patch.object(linkcheck, "fetch", raising(err)):
            res = linkcheck.check("https://forms.office.com/g/abc")
        self.assertEqual(res[0], "blocked")
        self.assertIn("bot wall", res[1])
        with mock.patch.object(linkcheck, "fetch", raising(err)):
            self.assertEqual(linkcheck.check("https://forms.cloud.microsoft/g/abc")[0], "blocked")

    def test_other_hosts_503_twice_stay_broken_and_404_stays_broken(self):
        e503 = urllib.error.HTTPError("https://x.example/", 503, "Service Unavailable", {}, None)
        with mock.patch.object(linkcheck, "fetch", raising(e503)):
            self.assertEqual(linkcheck.check("https://x.example/")[0], "broken")
        e404 = urllib.error.HTTPError("https://x.example/", 404, "Not Found", {}, None)
        with mock.patch.object(linkcheck, "fetch", raising(e404)):
            self.assertEqual(linkcheck.check("https://x.example/"), ("broken", 404))

    def test_a_working_form_is_ok(self):
        with mock.patch.object(linkcheck, "fetch", lambda url, method: 200):
            self.assertEqual(linkcheck.check("https://forms.office.com/g/abc"), ("ok", 200))


if __name__ == "__main__":
    unittest.main()
