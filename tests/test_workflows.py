"""Checks on the GitHub workflow files. Stdlib only, no YAML parser.

Run: python3 -m unittest discover -s tests -v
"""
import os
import re
import subprocess
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WORKFLOW_DIR = os.path.join(ROOT, ".github", "workflows")
TRIM_CHECKED = ("links.yml", "freshness.yml")
SCRIPTS = ("linkcheck", "freshness")


def workflow_files():
    return sorted(
        name for name in os.listdir(WORKFLOW_DIR)
        if os.path.isfile(os.path.join(WORKFLOW_DIR, name))
    )


def read_workflow(name):
    with open(os.path.join(WORKFLOW_DIR, name), encoding="utf-8") as f:
        return f.read()


def job_block(name, job):
    """Return the lines of one top-level job in a workflow (without the job key line)."""
    lines = read_workflow(name).splitlines()
    starts = [i for i, line in enumerate(lines) if line == "  %s:" % job]
    assert len(starts) == 1, "%s needs exactly one '%s' job" % (name, job)
    block = []
    for line in lines[starts[0] + 1:]:
        if re.match(r"^(\S|  \S)", line):
            break
        block.append(line)
    return block


def read_workflow_test_floor():
    path = os.path.join(ROOT, "tests", "r3-tests-5-page-script-coverage-floor.test.mjs")
    with open(path, encoding="utf-8") as f:
        return f.read()


def job_names(name):
    text = read_workflow(name)
    jobs = text.split("\njobs:\n", 1)[1]
    return re.findall(r"(?m)^  ([A-Za-z0-9_-]+):\s*$", jobs)


class WorkflowTests(unittest.TestCase):
    def test_every_workflow_has_a_timeout(self):
        for name in workflow_files():
            with self.subTest(workflow=name):
                text = read_workflow(name)
                self.assertRegex(text, r"(?m)^\s*timeout-minutes:", "%s has no timeout-minutes line" % name)

    def test_issue_body_is_trimmed_before_gh_issue(self):
        for name in TRIM_CHECKED:
            with self.subTest(workflow=name):
                text = read_workflow(name)
                trim = text.find("head -c")
                issue = text.find("gh issue")
                self.assertNotEqual(trim, -1, "%s has no 'head -c' trim" % name)
                self.assertNotEqual(issue, -1, "%s has no 'gh issue' command" % name)
                self.assertLess(trim, issue, "%s trims after its first 'gh issue' command" % name)

    def test_links_workflow_has_separate_program_and_sources_jobs(self):
        self.assertEqual(job_names("links.yml"), ["links", "sources"])
        links = "\n".join(job_block("links.yml", "links"))
        sources = "\n".join(job_block("links.yml", "sources"))
        self.assertIn("timeout-minutes: 60", links)
        self.assertIn("if: github.event.schedule != '17 14 * * 4'", links)
        self.assertIn("--out link-report.md --workers 16 --budget-minutes 40", links)
        self.assertNotIn("--aux", links)
        self.assertNotIn("sources_fetched", links)
        self.assertIn("timeout-minutes: 210", sources)
        self.assertIn("if: github.event.schedule == '17 14 * * 4'", sources)
        self.assertIn(
            "--fields url,apply_url,sources_fetched --aux --out link-report.md --workers 16 --budget-minutes 170",
            sources,
        )
        # The budget must leave room inside the job timeout for checkout and upload.
        budget = int(re.search(r"--budget-minutes (\d+)", sources).group(1))
        timeout = int(re.search(r"timeout-minutes: (\d+)", sources).group(1))
        self.assertGreaterEqual(budget, 150, "about 4,900 urls need a long budget")
        self.assertGreaterEqual(timeout - budget, 30)
        for job, text in (("links", links), ("sources", sources)):
            with self.subTest(job=job):
                self.assertIn("kinds=", text)
                self.assertIn('grep -q \'^## Broken$\' link-report.md && kinds="program links"', text)
                self.assertIn("sources\"", text)
                self.assertIn("aux links\"", text)
                self.assertIn('--title "Broken links: $kinds ($(date -u +%Y-%m-%d))"', text)
                self.assertIn("--label link-check", text)
                self.assertIn("gh issue comment", text)

    def test_dates_issue_only_comments_when_the_report_changed(self):
        text = read_workflow("dates.yml")
        for token in (
            "sha256sum",
            "report_sha=",
            "<!-- report-sha256: $report_sha -->",
            "gh issue view",
            "report-sha256: [0-9a-f]*",
            'if [ "$last_sha" = "$report_sha" ]',
            "not commenting",
            "gh issue comment",
        ):
            with self.subTest(token=token):
                self.assertIn(token, text)
        self.assertLess(text.find('"$last_sha" = "$report_sha"'), text.find("gh issue comment"))
        self.assertNotIn("head -c", text, "dates.yml trims by lines, not bytes")
        trim = text.find("head -n 400 issue-body.md > issue-body-trimmed.md")
        self.assertNotEqual(trim, -1)
        self.assertLess(trim, text.find("gh issue create"))
        self.assertIn("% 2 )) -eq 1", text)
        self.assertIn("echo '```' >> issue-body-trimmed.md", text)

    def test_script_flags_in_workflows_exist_in_help(self):
        # (script, flag) -> workflow files whose command lines use it
        used = {}
        for name in workflow_files():
            for line in read_workflow(name).splitlines():
                for script in SCRIPTS:
                    if "tools/%s.py" % script not in line:
                        continue
                    for flag in set(re.findall(r"--[a-z][a-z-]*", line)):
                        used.setdefault((script, flag), set()).add(name)

        help_text = {}
        for script in SCRIPTS:
            proc = subprocess.run(
                [sys.executable, os.path.join("tools", "%s.py" % script), "--help"],
                cwd=ROOT, capture_output=True, text=True, check=False,
            )
            with self.subTest(script=script):
                self.assertEqual(proc.returncode, 0, "%s --help failed: %s" % (script, proc.stderr))
            help_text[script] = proc.stdout + proc.stderr

        for (script, flag), files in sorted(used.items()):
            with self.subTest(script=script, flag=flag, workflows=sorted(files)):
                self.assertIn(
                    flag, help_text[script],
                    "%s is used in workflow(s) %s but python3 tools/%s.py --help does not list it"
                    % (flag, ", ".join(sorted(files)), script),
                )

    def test_coverage_job_keeps_both_floors_from_the_shard_dumps(self):
        # The lib.js and page script floors are one job in ci.yml that reads the
        # V8 dumps the js shards upload. Deleting the job, the download, the
        # dump collection or the floor test fails here.
        coverage = " ".join(job_block("ci.yml", "coverage"))
        self.assertIn("needs: [js]", coverage)
        self.assertIn("timeout-minutes: 15", coverage)
        self.assertIn("npm ci", " ".join(job_block("ci.yml", "js")))
        for token in (
            "actions/download-artifact@",
            "pattern: coverage-v8-shard-*",
            "path: coverage-v8",
            "COVERAGE_DIR=coverage-v8",
            "node --test tests/r3-tests-5-page-script-coverage-floor.test.mjs",
        ):
            with self.subTest(token=token):
                self.assertIn(token, coverage, "coverage job in ci.yml lacks '%s'" % token)
        js = " ".join(job_block("ci.yml", "js"))
        for token in (
            "NODE_V8_COVERAGE: ${{ github.workspace }}/coverage-v8",
            "actions/upload-artifact@",
            "name: coverage-v8-shard-${{ matrix.shard }}",
            "path: coverage-v8",
            "--max-old-space-size=7168",
            "--test-concurrency=2 --test-shard=${{ matrix.shard }}/4",
        ):
            with self.subTest(token=token):
                self.assertIn(token, js, "js job in ci.yml lacks '%s'" % token)
        floor = read_workflow_test_floor()
        self.assertIn("export const LIB_FLOOR = 99;", floor)
        self.assertNotIn("--experimental-test-coverage", read_workflow("ci.yml"))
        self.assertNotIn("page-script-coverage:", read_workflow("ci.yml"))

    def test_ci_has_python_js_check_deploy_and_one_coverage_job(self):
        self.assertEqual(job_names("ci.yml"), ["python", "js", "check", "deploy", "coverage"])

    def test_ci_python_job_runs_the_python_side_in_full(self):
        text = "\n".join(job_block("ci.yml", "python"))
        self.assertIn("timeout-minutes: 20", text)
        for command in (
            "pip install -r requirements-dev.txt",
            "python3 tools/validate.py",
            "python3 -m unittest discover -s tests -v",
            "python3 tools/build_data.py",
            "python3 tools/build.py",
            "git diff --exit-code -- data/entries.json data/entries.csv data/meta.json data/lite data/detail sitemap.xml robots.txt '*.html'",
            "-P '\\x{2014}|\\x{2013}'",
        ):
            with self.subTest(command=command):
                self.assertIn(command, text)
        self.assertNotIn("node --test", text)
        self.assertNotIn("npm ci", text)

    def test_ci_js_job_is_four_shards_of_the_whole_suite(self):
        block = job_block("ci.yml", "js")
        text = "\n".join(block)
        self.assertIn("    timeout-minutes: 20", block)
        self.assertIn("        shard: [1, 2, 3, 4]", block)
        self.assertEqual(text.count("matrix:"), 1)
        self.assertEqual(text.count("node --test"), 1, "the js job runs node --test exactly once")
        self.assertIn(
            "        run: node --test --test-concurrency=2 --test-shard=${{ matrix.shard }}/4 tests/*.test.mjs", block
        )
        self.assertIn("npm ci", text)
        self.assertNotIn("continue-on-error", text)

    def test_ci_check_job_gates_on_python_and_every_js_shard(self):
        block = job_block("ci.yml", "check")
        text = "\n".join(block)
        self.assertIn("    needs: [python, js]", block)
        self.assertIn("    if: always()", block)
        self.assertIn("    timeout-minutes: 5", block)
        self.assertIn('needs.python.result }}" != "success"', text)
        self.assertIn('needs.js.result }}" != "success"', text)
        self.assertIn("exit 1", text)
        self.assertNotIn("continue-on-error", text)
        self.assertNotIn("actions/checkout", text, "check only reads needs results")


if __name__ == "__main__":
    unittest.main()
