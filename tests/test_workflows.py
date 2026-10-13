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

    def test_lib_coverage_job_keeps_its_floor(self):
        # The lib.js coverage floor is its own job in ci.yml. Deleting the job,
        # or its thresholds or include path, fails here.
        lines = read_workflow("ci.yml").splitlines()
        starts = [i for i, line in enumerate(lines) if line == "  lib-coverage:"]
        self.assertEqual(len(starts), 1, "ci.yml needs exactly one 'lib-coverage' job")
        block = []
        for line in lines[starts[0] + 1:]:
            if re.match(r"^(\S|  \S)", line):
                break
            block.append(line)
        tokens = set(" ".join(block).split())
        for token in (
            "--experimental-test-coverage",
            "--test-coverage-include=assets/js/lib.js",
            "--test-coverage-lines=99",
            "--test-coverage-branches=97",
            "tests/*.test.mjs",
        ):
            with self.subTest(token=token):
                self.assertIn(token, tokens, "lib-coverage job in ci.yml lacks '%s'" % token)
        self.assertIn("npm ci", " ".join(block), "lib-coverage job must run npm ci first")

    def test_ci_has_python_js_check_and_the_two_coverage_jobs(self):
        self.assertEqual(
            job_names("ci.yml"), ["python", "js", "check", "deploy", "lib-coverage", "page-script-coverage"]
        )

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
            "        run: node --test --test-shard=${{ matrix.shard }}/4 tests/*.test.mjs", block
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
