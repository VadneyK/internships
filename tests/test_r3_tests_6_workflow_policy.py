"""Policy checks on the GitHub workflow files. Stdlib only, no YAML parser.

Checks: every workflow has a top-level permissions block with no write-all;
only the workflows that open issues may grant issues: write, and none grants
contents: write; no workflow uses pull_request_target; each action is pinned
to one major version across all workflows; ci.yml runs the commands that
docs/TESTING.md tells people to run; every workflow that sets up Node reads .nvmrc, which is at least the
minimum Node that CONTRIBUTING.md states; package.json engines match it; every
pip install uses requirements-dev.txt (exact pins); dependabot watches pip.

Run: python3 -m unittest discover -s tests -v
"""
import json
import os
import re
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WORKFLOW_DIR = os.path.join(ROOT, ".github", "workflows")

# Workflows that open or update issues. Only these may grant issues: write.
# links.yml needs it to open the link-check issue, so it is listed here too.
# dates.yml opens or updates the dates issue.
# lighthouse.yml opens or updates the perf issue.
ISSUE_WRITERS = ("dates.yml", "freshness.yml", "lighthouse.yml", "links.yml")

CI_COMMANDS = (
    "python3 tools/validate.py",
    "python3 -m unittest discover -s tests",
    "node --test --test-concurrency=2 --test-shard=${{ matrix.shard }}/4 tests/*.test.mjs",
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
                # Actions are pinned to a 40 character SHA; the version tag is the trailing comment.
                match = re.search(
                    r"uses:\s*['\"]?([^\s@'\"]+)@[0-9a-f]{40}['\"]?\s+#\s*v(\d+)", line
                )
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

    def test_every_action_is_pinned_to_a_full_sha_with_a_version_comment(self):
        for name in workflow_files():
            for line in read_workflow(name).splitlines():
                if re.match(r"\s*(- )?uses:", line):
                    with self.subTest(workflow=name, line=line.strip()):
                        self.assertRegex(
                            line, r"uses:\s*[^\s@]+@[0-9a-f]{40} # v\d+(\.\d+)*\s*$"
                        )

    def test_every_checkout_does_not_persist_credentials(self):
        for name in workflow_files():
            lines = read_workflow(name).splitlines()
            for i, line in enumerate(lines):
                if "uses: actions/checkout@" in line:
                    with self.subTest(workflow=name, line=i + 1):
                        self.assertEqual(
                            [l.strip() for l in lines[i + 1:i + 3]],
                            ["with:", "persist-credentials: false"],
                        )

    def test_ci_and_codeql_cancel_superseded_runs_only_for_pull_requests(self):
        for name in ("ci.yml", "codeql.yml"):
            with self.subTest(workflow=name):
                text = read_workflow(name)
                self.assertIn(
                    "concurrency:\n  group: ${{ github.workflow }}-${{ github.ref }}\n"
                    "  cancel-in-progress: ${{ github.event_name == 'pull_request' }}\n",
                    text,
                )

    def test_dependabot_actions_have_a_cooldown_and_one_group(self):
        text = read_text(os.path.join(ROOT, ".github", "dependabot.yml"))
        block = text.split('package-ecosystem: "github-actions"', 1)[1].split("package-ecosystem:", 1)[0]
        self.assertRegex(block, r"cooldown:\s*\n\s+default-days: 7\b")
        self.assertRegex(block, r'groups:\s*\n\s+github-actions:\s*\n\s+patterns:\s*\n\s+- "\*"')

    def test_ci_runs_the_commands_testing_md_names(self):
        text = read_workflow("ci.yml")
        for command in CI_COMMANDS:
            with self.subTest(command=command):
                self.assertIn(command, text, "ci.yml does not run '%s'" % command)

    def test_ci_jobs_each_have_a_timeout_and_no_job_level_permissions(self):
        # The sharded CI keeps the read-only default: contents: read at the top,
        # no job widens it, and no job can hang for the six-hour default.
        text = read_workflow("ci.yml")
        self.assertEqual(top_level_permissions(text), ["contents: read"])
        jobs = text.split("\njobs:\n", 1)[1]
        names = re.findall(r"(?m)^  ([A-Za-z0-9_-]+):\s*$", jobs)
        self.assertEqual(names, ["python", "js", "check", "deploy", "coverage"])
        self.assertEqual(len(re.findall(r"(?m)^    timeout-minutes: \d+$", jobs)), len(names))
        # 2026-10-13: only the deploy job widens permissions, and only to what GitHub Pages needs.
        self.assertEqual(len(re.findall(r"(?m)^\s+permissions:", jobs)), 1)
        deploy = jobs.split("\n  deploy:\n", 1)[1].split("\n  coverage:", 1)[0]
        perms = re.search(r"(?m)^    permissions:\n((?:      .+\n)+)", deploy).group(1)
        self.assertEqual(sorted(l.strip() for l in perms.splitlines()), ["contents: read", "id-token: write", "pages: write"])
        self.assertRegex(deploy, r"(?m)^    needs: \[check\]$")
        self.assertIn("if: github.event_name == 'push' && github.ref == 'refs/heads/main'", deploy)
        self.assertNotIn("contents: write", text)
        self.assertNotIn("pull_request_target", text)

    def test_ci_node_suite_runs_only_as_four_shards_in_the_required_job(self):
        text = read_workflow("ci.yml")
        self.assertEqual(
            text.count("node --test --test-concurrency=2 --test-shard=${{ matrix.shard }}/4 tests/*.test.mjs"), 1
        )
        self.assertEqual(len(re.findall(r"shard: \[1, 2, 3, 4\]", text)), 1)
        self.assertRegex(text, r"(?m)^    needs: \[python, js\]$")
        self.assertRegex(text, r"(?m)^    if: always\(\)$")

    def test_ci_node_version_comes_from_nvmrc_and_meets_the_minimum_in_contributing(self):
        contributing = read_text(os.path.join(ROOT, "CONTRIBUTING.md"))
        stated = re.search(r"Node\s+(\d+)\.(\d+)\s+or newer", contributing)
        self.assertIsNotNone(
            stated, "CONTRIBUTING.md does not state a Node minimum like 'Node 22.22 or newer'"
        )
        minimum = (int(stated.group(1)), int(stated.group(2)))
        nvmrc = read_text(os.path.join(ROOT, ".nvmrc")).strip()
        parsed = re.fullmatch(r"v?(\d+)\.(\d+)\.\d+", nvmrc)  # 2026-10-13: full major.minor.patch so CI and local runs match
        self.assertIsNotNone(parsed, ".nvmrc must name major.minor.patch, got %r" % nvmrc)
        pinned = (int(parsed.group(1)), int(parsed.group(2)))
        self.assertGreaterEqual(
            pinned, minimum,
            ".nvmrc is Node %s but CONTRIBUTING.md asks for Node %d.%d or newer"
            % (nvmrc, minimum[0], minimum[1]),
        )
        for name in workflow_files():
            text = read_workflow(name)
            if "actions/setup-node" not in text:
                continue
            with self.subTest(workflow=name):
                self.assertNotRegex(
                    text, r"node-version:\s", "%s hardcodes node-version; use node-version-file" % name
                )
                self.assertEqual(
                    text.count("actions/setup-node"),
                    len(re.findall(r"node-version-file:\s*\.nvmrc\s*$", text, re.M)),
                    "%s has a setup-node step without node-version-file: .nvmrc" % name,
                )
        engines = json.loads(read_text(os.path.join(ROOT, "package.json"))).get("engines", {})
        self.assertEqual(engines.get("node"), ">=%d.%d" % minimum, "package.json engines.node")

    def test_every_workflow_installs_python_tools_from_requirements_dev(self):
        reqs = read_text(os.path.join(ROOT, "requirements-dev.txt"))
        pins = [l for l in reqs.splitlines() if l.strip() and not l.startswith("#")]
        self.assertTrue(pins)
        for line in pins:
            self.assertRegex(line, r"^[A-Za-z0-9_.-]+==[0-9][0-9A-Za-z.]*$", "unpinned: %r" % line)
        self.assertTrue(any(l.startswith("jsonschema==") for l in pins))
        for name in workflow_files():
            text = read_workflow(name)
            with self.subTest(workflow=name):
                for m in re.finditer(r"pip install(.*)", text):
                    self.assertEqual(m.group(1).strip(), "-r requirements-dev.txt", name)
        self.assertIn("pip install -r requirements-dev.txt", read_workflow("ci.yml"))

    def test_lighthouse_workflow_shape(self):
        text = read_workflow("lighthouse.yml")
        self.assertEqual(top_level_permissions(text), ["contents: read", "issues: write"])
        self.assertIn("workflow_dispatch:", text)
        self.assertRegex(text, r"(?m)^    - cron: ")
        self.assertRegex(
            text,
            r"(?m)uses: treosh/lighthouse-ci-action@3e7e23fb74242897f95c0ba9cabad3d0227b9b18 # v12\s*$",
        )
        self.assertRegex(text, r"(?m)^          runs: 3$")
        urls = re.findall(r"(?m)^            (https://vadneyk\.github\.io/internships/\S*)$", text)
        self.assertEqual(urls, [
            "https://vadneyk.github.io/internships/",
            "https://vadneyk.github.io/internships/find.html?at=city:boston",
            "https://vadneyk.github.io/internships/calendar.html",
            "https://vadneyk.github.io/internships/permit.html",
            "https://vadneyk.github.io/internships/younger.html",
            "https://vadneyk.github.io/internships/jobs.html",
        ])
        self.assertIn("--label perf", text)
        config = json.loads(read_text(os.path.join(ROOT, "lighthouserc.json")))["ci"]
        self.assertEqual(config["collect"]["numberOfRuns"], 3)
        self.assertEqual(config["collect"]["settings"]["formFactor"], "mobile")
        self.assertEqual(config["assert"]["assertions"], {
            "categories:accessibility": ["error", {"minScore": 0.95}],
            "categories:best-practices": ["error", {"minScore": 0.9}],
            "categories:seo": ["error", {"minScore": 0.9}],
            "categories:performance": ["warn", {"minScore": 0.8}],
        })

    def test_dependabot_watches_pip(self):
        text = read_text(os.path.join(ROOT, ".github", "dependabot.yml"))
        self.assertRegex(text, r'package-ecosystem:\s*"pip"')


if __name__ == "__main__":
    unittest.main()
