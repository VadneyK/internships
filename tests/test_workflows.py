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


if __name__ == "__main__":
    unittest.main()
