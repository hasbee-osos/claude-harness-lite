#!/usr/bin/env node
/**
 * Git safety guard (PreToolUse hook, matcher: Bash).
 *
 * Blocks:
 *  1. Force pushes and other destructive git operations.
 *  2. Commits/pushes/branch mutation while on a protected branch.
 *
 * Input:  JSON on stdin (Claude Code hook payload).
 * Output: JSON deny decision on stdout when blocked; silent allow otherwise.
 */
const ALLOW_MESSAGE =
  "Blocked by engineering-harness git-guard. " +
  "If the human explicitly authorizes this operation, they may run it themselves or adjust the guard.";

const PROTECTED = ["main", "master", "develop", "development"];
const PROTECTED_PREFIXES = ["release/"];

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

function isProtected(branch) {
  if (!branch) return false;
  if (PROTECTED.includes(branch)) return true;
  return PROTECTED_PREFIXES.some((p) => branch.startsWith(p));
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

  if (!/\bgit\b/.test(cmd)) process.exit(0);

  for (const re of DESTRUCTIVE) {
    if (re.test(cmd)) {
      deny("Destructive git operation is not allowed by default: `" + cmd.trim() + "`.");
    }
  }

  if (/\bgit\s+(commit|push|merge|rebase|am)\b/.test(cmd)) {
    const branch = currentBranch();
    if (isProtected(branch)) {
      deny(
        "Refusing to run `" +
          cmd.trim() +
          "` on protected branch `" +
          branch +
          "`. Create a feature branch (e.g. feature/<ticket-id>) first."
      );
    }
  }

  process.exit(0);
});
