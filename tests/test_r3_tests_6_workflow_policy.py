"""Policy checks on the GitHub workflow files. Stdlib only, no YAML parser.

Checks: every workflow has a top-level permissions block with no write-all;
only the workflows that open issues may grant issues: write, and none grants
contents: write; no workflow uses pull_request_target; each action is pinned
to one major version across all workflows; ci.yml runs the commands that
docs/TESTING.md tells people to run; ci.yml's Node major is at least the
minimum Node that CONTRIBUTING.md states.

Run: python3 -m unittest discover -s tests -v
"""
import os
import re
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WORKFLOW_DIR = os.path.join(ROOT, ".github", "workflows")

# Workflows that open or update issues. Only these may grant issues: write.
# links.yml needs it to open the link-check issue, so it is listed here too.
ISSUE_WRITERS = ("freshness.yml", "links.yml")

CI_COMMANDS = (
    "python3 tools/validate.py",
    "python3 -m unittest discover -s tests",
    "node --test tests/*.test.mjs",
    "python3 tools/build_data.py",
    "python3 tools/build.py",
)


def workflow_files():
    return sorted(
        name for name in os.listdir(WORKFLOW_DIR)
        if name.endswith((".yml", ".yaml"))
        and os.path.isfile(os.path.join(WORKFLOW_DIR, name))
    )


def read_text(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def read_workflow(name):
    return read_text(os.path.join(WORKFLOW_DIR, name))


def strip_comment(line):
    # Workflow lines in this repo never put "#" inside a quoted value.
    return line.split("#", 1)[0]


def top_level_permissions(text):
    """Return the indented lines under the top-level 'permissions:' key, or None."""
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if re.match(r"^permissions:\s*(#.*)?$", line):
            block = []
            for nxt in lines[i + 1:]:
                if nxt.strip() == "" or nxt.lstrip().startswith("#"):
                    continue
                if not nxt.startswith((" ", "\t")):
                    break
                block.append(strip_comment(nxt).strip())
            return block
    return None


def permission_grants(block, scope, level):
    """True when the permissions block sets scope to level (e.g. issues, write)."""
    for entry in block:
        if re.fullmatch(r"%s:\s*%s" % (re.escape(scope), re.escape(level)), entry):
            return True
    return False


class WorkflowPolicyTests(unittest.TestCase):
    def test_every_workflow_has_a_top_level_permissions_block(self):
        for name in workflow_files():
            with self.subTest(workflow=name):
                self.assertIsNotNone(
                    top_level_permissions(read_workflow(name)),
                    "%s has no top-level permissions block" % name,
                )

    def test_no_workflow_uses_write_all(self):
        for name in workflow_files():
            with self.subTest(workflow=name):
                for line in read_workflow(name).splitlines():
                    self.assertNotIn(
                        "write-all", strip_comment(line),
                        "%s grants write-all" % name,
                    )

    def test_only_issue_writers_grant_issues_write(self):
        for name in workflow_files():
            with self.subTest(workflow=name):
                block = top_level_permissions(read_workflow(name)) or []
                granted = permission_grants(block, "issues", "write")
                if name in ISSUE_WRITERS:
                    self.assertTrue(granted, "%s should grant issues: write" % name)
                else:
                    self.assertFalse(granted, "%s grants issues: write but does not open issues" % name)

    def test_no_workflow_grants_contents_write(self):
        for name in workflow_files():
            with self.subTest(workflow=name):
                block = top_level_permissions(read_workflow(name)) or []
                self.assertFalse(
                    permission_grants(block, "contents", "write"),
                    "%s grants contents: write" % name,
                )

    def test_no_workflow_uses_pull_request_target(self):
        for name in workflow_files():
            with self.subTest(workflow=name):
                for line in read_workflow(name).splitlines():
                    self.assertNotIn(
                        "pull_request_target", strip_comment(line),
                        "%s uses pull_request_target" % name,
                    )

    def test_each_action_has_one_major_version_across_workflows(self):
        # action name -> {major: set of workflow files}
        seen = {}
        for name in workflow_files():
            for line in read_workflow(name).splitlines():
                match = re.search(r"uses:\s*['\"]?([^\s@'\"]+)@v?(\d+)", strip_comment(line))
                if match:
                    action, major = match.group(1), match.group(2)
                    seen.setdefault(action, {}).setdefault(major, set()).add(name)
        for action, majors in sorted(seen.items()):
            with self.subTest(action=action):
                self.assertEqual(
                    len(majors), 1,
                    "%s is used at more than one major version: %s"
                    % (action, "; ".join(
                        "v%s in %s" % (m, ", ".join(sorted(files)))
                        for m, files in sorted(majors.items())
                    )),
                )

    def test_ci_runs_the_commands_testing_md_names(self):
        text = read_workflow("ci.yml")
        for command in CI_COMMANDS:
            with self.subTest(command=command):
                self.assertIn(command, text, "ci.yml does not run '%s'" % command)

    def test_ci_node_major_meets_the_minimum_stated_in_contributing(self):
        contributing = read_text(os.path.join(ROOT, "CONTRIBUTING.md"))
        stated = re.search(r"Node\s+(\d+)\+", contributing)
        self.assertIsNotNone(stated, "CONTRIBUTING.md does not state a Node minimum like 'Node 20+'")
        minimum = int(stated.group(1))
        node_version = re.search(r"node-version:\s*['\"]?(\d+)", read_workflow("ci.yml"))
        self.assertIsNotNone(node_version, "ci.yml has no node-version line")
        self.assertGreaterEqual(
            int(node_version.group(1)), minimum,
            "ci.yml runs Node %s but CONTRIBUTING.md asks for Node %d+"
            % (node_version.group(1), minimum),
        )


if __name__ == "__main__":
    unittest.main()
