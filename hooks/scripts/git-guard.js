#!/usr/bin/env node
/**
 * Git safety guard (PreToolUse hook, matcher: Bash|PowerShell).
 *
 * Blocks:
 *  1. Force pushes and other destructive git operations.
 *  2. Commits/pushes/branch mutation while on a protected branch.
 *  3. Any GitHub CLI (gh) command outside a read-only + PR-create allowlist.
 *
 * Input:  JSON on stdin (Claude Code hook payload).
 * Output: JSON deny decision on stdout when blocked; silent allow otherwise.
 */
const ALLOW_MESSAGE =
  "Blocked by engineering-harness git-guard. " +
  "If the human explicitly authorizes this operation, they may run it themselves or adjust the guard.";

const path = require("path");
const fs = require("fs");

const STRATEGY_FILE = path.join(__dirname, "..", "..", "skills", "git-workflow", "SKILL.md");

// Protected branches are defined once, in the git-workflow skill's ```protected-branches block.
function loadProtected() {
  try {
    const text = fs.readFileSync(STRATEGY_FILE, "utf8");
    const m = text.match(/```protected-branches\r?\n([\s\S]*?)```/);
    if (!m) return null;
    return m[1]
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((p) => new RegExp("^" + p.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*") + "$"));
  } catch {
    return null;
  }
}

const DESTRUCTIVE = [
  /\bgit\s+push\b[^|;&]*\s(--force|--force-with-lease)\b/,
  /\bgit\s+push\b[^|;&]*\s(-f)\b/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\s+(-[a-zA-Z]*f|--force)/,
  /\bgit\s+checkout\s+[^|;&]*--\s+\./,
  /\bgit\s+branch\s+-[a-zA-Z]*D/,
  /\bgit\s+filter-branch\b/,
  /\bgit\s+rebase\b[^|;&]*--onto\s+(main|master|develop)\b/
];

// gh runs with the human's full GitHub permissions, so allow only reads and opening PRs.
const GH_ALLOWED = {
  pr: ["create", "view", "list", "diff", "checks", "status"],
  run: ["list", "view"],
  auth: ["status"]
};

function ghViolation(cmd) {
  const re = /(?:^|[\s;&|(`$])gh(?:\.exe)?(?=\s|$)([^;&|\n)`]*)/g;
  let m;
  while ((m = re.exec(cmd)) !== null) {
    const args = m[1].trim().split(/\s+/).filter(Boolean);
    const [group, action] = args;
    if (!group || group === "--version") continue;
    if (group === "api") {
      const text = " " + args.slice(1).join(" ") + " ";
      const method = text.match(/\s(?:-X\s*|--method[=\s]+)(\S+)/i);
      const writes =
        (method && method[1].toUpperCase() !== "GET") ||
        /\s(-f|-F|--field|--raw-field|--input)(\s|=)/.test(text) ||
        /^\s*graphql\b/.test(args.slice(1).join(" "));
      if (writes) return "gh api " + args.slice(1).join(" ");
      continue;
    }
    if (!(GH_ALLOWED[group] || []).includes(action)) return "gh " + args.join(" ");
  }
  return null;
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason + " " + ALLOW_MESSAGE
      }
    })
  );
  process.exit(0);
}

function currentBranch() {
  try {
    const { execSync } = require("child_process");
    // `branch --show-current` (unlike rev-parse) also works on unborn branches.
    return execSync("git branch --show-current", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return null;
  }
}

function isProtected(branch, rules) {
  return Boolean(branch) && rules.some((re) => re.test(branch));
}

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let cmd = "";
  try {
    const payload = JSON.parse(raw);
    cmd = String((payload.tool_input && payload.tool_input.command) || "");
  } catch {
    process.exit(0);
  }

  const gh = ghViolation(cmd);
  if (gh) {
    deny(
      "GitHub CLI command not allowed: `" + gh.trim() + "`. Agents may only read (pr view/list/diff/checks/status, run list/view, GET api) and open PRs (pr create); never merge, approve, comment, or trigger workflows."
    );
  }

  if (!/\bgit\b/.test(cmd)) process.exit(0);

  for (const re of DESTRUCTIVE) {
    if (re.test(cmd)) {
      deny("Destructive git operation is not allowed by default: `" + cmd.trim() + "`.");
    }
  }

  if (/\bgit\s+(commit|push|merge|rebase|am)\b/.test(cmd)) {
    const rules = loadProtected();
    if (!rules) {
      deny(
        "Cannot read the protected-branches block from " + STRATEGY_FILE + "; refusing `" + cmd.trim() + "` until it is fixed."
      );
    }
    const branch = currentBranch();
    if (isProtected(branch, rules)) {
      deny(
        "Refusing to run `" +
          cmd.trim() +
          "` on protected branch `" +
          branch +
          "`. Create a ticket branch per the git-workflow skill first."
      );
    }
  }

  process.exit(0);
});
