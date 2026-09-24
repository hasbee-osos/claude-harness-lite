#!/usr/bin/env node
/**
 * Git safety guard (PreToolUse hook, matcher: Bash|PowerShell).
 *
 * Blocks:
 *  1. Force pushes and other destructive git operations.
 *  2. Commits/pushes/merges while on a protected branch, and pushes whose destination is a
 *     protected branch. The branch is checked in the repo each git command actually targets
 *     (session cwd, `cd`/`Set-Location`/`pushd`, `git -C`), so it works from a multi-repo
 *     workspace. Write commands whose target repo cannot be determined are denied.
 *  3. Any GitHub CLI (gh) command outside a read-only + PR-create allowlist.
 *  4. Merging (or pulling) a protected branch into any branch but a conflict resolve branch, so
 *     a ticket branch never carries a long-lived branch into its other PRs.
 *
 * Exception: the harness's own record repo (the brain) is identified by a BRAIN_MARKER file at
 * its root, not by its folder name. Commits and pushes are allowed there on any branch, because
 * the brain is a shared log the harness is meant to write to. Force-pushing and history rewriting
 * stay blocked there like everywhere else.
 *
 * Input:  JSON on stdin (Claude Code hook payload).
 * Output: JSON deny decision on stdout when blocked; silent allow otherwise.
 */
const ALLOW_MESSAGE =
  "Blocked by engineering-harness git-guard. " +
  "If the human explicitly authorizes this operation, they may run it themselves or adjust the guard.";

const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");

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
  /\bgit\b[^|;&\n]*\spush\b[^|;&\n]*\s(--force|--force-with-lease|--force-if-includes)\b/,
  /\bgit\b[^|;&\n]*\spush\b[^|;&\n]*\s-[a-zA-Z]*f\b/,
  /\bgit\b[^|;&\n]*\sreset\s+--hard\b/,
  /\bgit\b[^|;&\n]*\sclean\s+(-[a-zA-Z]*f|--force)/,
  /\bgit\b[^|;&\n]*\scheckout\s+[^|;&\n]*--\s+\./,
  /\bgit\b[^|;&\n]*\sbranch\s+-[a-zA-Z]*D/,
  /\bgit\b[^|;&\n]*\sfilter-branch\b/,
  /\bgit\b[^|;&\n]*\srebase\b[^|;&\n]*--onto\s+(main|master|develop)\b/
];

// git subcommands that create commits on, or publish, a branch.
const WRITE_SUBCOMMANDS = new Set(["commit", "push", "merge", "rebase", "am", "cherry-pick", "revert"]);
// The lookahead keeps read-only relatives such as `merge-base` and `merge-tree` out.
const WRITE_TEXT = /\bgit(?:\.exe)?\b[^\n;&|]*?\s(commit|push|merge|rebase|am|cherry-pick|revert)(?![\w-])/g;

// gh runs with the human's full GitHub permissions, so allow only reads and opening PRs.
const GH_ALLOWED = {
  pr: ["create", "view", "list", "diff", "checks", "status"],
  run: ["list", "view"],
  auth: ["status"]
};

function ghViolation(cmd) {
  // gh by name, or by path (C:\Program Files\GitHub CLI\gh.exe, quoted or not)
  const re = /(?:^|[\s;&|(`$\/\\'"])gh(?:\.exe)?['"]?(?=\s|$)([^;&|\n)`]*)/g;
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

// --- Minimal shell parsing: words and control operators, quotes respected. ---

function tokenize(cmd) {
  const tokens = [];
  let word = null; // { value, dynamic }
  let quote = null;
  const flush = () => {
    if (word) tokens.push({ type: "word", value: word.value, dynamic: word.dynamic });
    word = null;
  };
  const add = (ch, dynamic) => {
    word = word || { value: "", dynamic: false };
    word.value += ch;
    if (dynamic) word.dynamic = true;
  };
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote) {
      if (ch === quote) quote = null;
      else add(ch, quote === '"' && (ch === "$" || ch === "`"));
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      word = word || { value: "", dynamic: false };
      continue;
    }
    if (/\s/.test(ch) && ch !== "\n") {
      flush();
      continue;
    }
    const two = cmd.slice(i, i + 2);
    if (two === "&&" || two === "||") {
      flush();
      tokens.push({ type: "op", value: two });
      i++;
      continue;
    }
    if (";|&\n()".includes(ch)) {
      flush();
      tokens.push({ type: "op", value: ch });
      continue;
    }
    add(ch, ch === "$" || ch === "`" || ch === "%");
  }
  flush();
  return tokens;
}

const UNKNOWN = null;

function resolveDir(base, word) {
  if (base === UNKNOWN || !word || word.dynamic || word.value === "-") return UNKNOWN;
  let p = word.value;
  const drive = p.match(/^\/([a-zA-Z])(\/|$)/); // Git Bash style /c/...
  if (drive && process.platform === "win32") p = drive[1] + ":/" + p.slice(3);
  if (p === "~" || p.startsWith("~/") || p.startsWith("~\\")) p = path.join(os.homedir(), p.slice(1));
  return path.resolve(base, p);
}

const CD = new Set(["cd", "chdir", "set-location", "sl", "pushd", "push-location"]);
const POP = new Set(["popd", "pop-location"]);

// Returns every git write command with the directory it runs in (UNKNOWN if undeterminable).
function gitWrites(cmd, startDir) {
  const writes = [];
  let cwd = startDir;
  const subshells = [];
  const pushed = [];
  let seg = [];

  const run = (words) => {
    let i = 0;
    while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i].value)) i++;
    if (i >= words.length) return;
    const name = words[i].value.toLowerCase().replace(/\.exe$/, "");
    const args = words.slice(i + 1);

    if (CD.has(name)) {
      const named = args.findIndex((w) => /^-(literal)?path$/i.test(w.value));
      const target = named >= 0 ? args[named + 1] : args.find((w) => !w.value.startsWith("-"));
      if (name === "pushd" || name === "push-location") pushed.push(cwd);
      cwd = target ? resolveDir(cwd, target) : cwd === UNKNOWN ? UNKNOWN : os.homedir();
      return;
    }
    if (POP.has(name)) {
      cwd = pushed.length ? pushed.pop() : UNKNOWN;
      return;
    }
    if (name !== "git") return;

    let dir = cwd;
    let j = 0;
    while (j < args.length && args[j].value.startsWith("-")) {
      const opt = args[j].value;
      if (opt === "-C") {
        dir = resolveDir(dir, args[j + 1]);
        j += 2;
      } else if (opt === "-c") {
        j += 2;
      } else if (/^--(git-dir|work-tree|namespace)/.test(opt)) {
        dir = UNKNOWN;
        j += opt.includes("=") ? 1 : 2;
      } else {
        j++;
      }
    }
    const sub = args[j] && args[j].value;
    if (WRITE_SUBCOMMANDS.has(sub) || sub === "pull") writes.push({ sub, dir, args: args.slice(j + 1) });
  };

  for (const t of tokenize(cmd)) {
    if (t.type === "word") {
      seg.push(t);
      continue;
    }
    run(seg);
    seg = [];
    if (t.value === "(") subshells.push(cwd);
    if (t.value === ")") cwd = subshells.length ? subshells.pop() : UNKNOWN;
  }
  run(seg);
  return writes;
}

function currentBranch(dir) {
  try {
    // `branch --show-current` (unlike rev-parse) also works on unborn branches.
    return execFileSync("git", ["-C", dir, "branch", "--show-current"], {
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

// The brain is the harness's own record repo. A marker file - not a folder name - grants the
// exception, so a product repo cannot inherit it by being renamed.
const BRAIN_MARKER = ".harness-brain";
function isBrainRepo(dir) {
  try {
    return fs.existsSync(path.join(dir, BRAIN_MARKER));
  } catch {
    return false;
  }
}

// Destination branches named explicitly on a push command line.
const PUSH_OPTS_WITH_VALUE = new Set(["--repo", "-o", "--push-option", "--receive-pack", "--exec"]);
function pushDestinations(args) {
  const positional = [];
  const flags = [];
  for (let i = 0; i < args.length; i++) {
    const v = args[i].value;
    if (PUSH_OPTS_WITH_VALUE.has(v)) i++;
    else if (v.startsWith("-")) flags.push(v);
    else positional.push(v);
  }
  const refspecs = positional.slice(1);
  return {
    all: flags.some((f) => ["--all", "--mirror", "--branches"].includes(f)),
    forced: refspecs.some((r) => r.startsWith("+")),
    destinations: refspecs.map((r) => r.replace(/^\+/, "").split(":").pop().replace(/^refs\/heads\//, ""))
  };
}

// Branches a merge or pull brings in, as named on the command line (remote prefix removed).
const MERGE_OPTS_WITH_VALUE = new Set(["-m", "-F", "--file", "-s", "--strategy", "-X", "--strategy-option", "--into-name"]);
function mergeSources(sub, args) {
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const v = args[i].value;
    if (["--abort", "--continue", "--quit", "--skip"].includes(v)) return [];
    if (MERGE_OPTS_WITH_VALUE.has(v)) i++;
    else if (!v.startsWith("-")) positional.push(v);
  }
  const refs = sub === "pull" ? positional.slice(1).map((r) => r.replace(/^\+/, "").split(":")[0]) : positional;
  return refs.map((r) => r.replace(/^refs\/heads\//, "").replace(/^(refs\/)?(remotes\/)?origin\//, ""));
}

// Only a resolve branch may take a long-lived branch in (git-workflow → Merge conflicts).
const RESOLVE_BRANCH = /-conflict-resolved(-\d+)?$/;

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let cmd = "";
  let startDir = process.cwd();
  try {
    const payload = JSON.parse(raw);
    cmd = String((payload.tool_input && payload.tool_input.command) || "");
    if (payload.cwd) startDir = payload.cwd;
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

  const writes = gitWrites(cmd, startDir);
  const mentioned = (cmd.match(WRITE_TEXT) || []).length;
  if (writes.length === 0 && mentioned === 0) process.exit(0);

  if (mentioned > writes.length) {
    deny(
      "Cannot determine the repository for every git write command in `" + cmd.trim() + "`. Run each git command on its own as `git -C <literal repo path> …` (not inside `bash -c`, subshells, or quoted text)."
    );
  }

  const rules = loadProtected();
  if (!rules) {
    deny("Cannot read the protected-branches block from " + STRATEGY_FILE + "; refusing `" + cmd.trim() + "` until it is fixed.");
  }

  for (const w of writes) {
    if (w.sub === "merge" || w.sub === "pull") {
      const hit = mergeSources(w.sub, w.args).find((s) => isProtected(s, rules));
      if (hit) {
        const branch = w.dir === UNKNOWN ? null : currentBranch(w.dir);
        if (!branch || !RESOLVE_BRANCH.test(branch)) {
          deny(
            "Refusing to merge long-lived branch `" + hit + "` into `" + (branch || "an unknown branch") + "`. Only a resolve branch (`<ticket-branch>-<target>-conflict-resolved`) may take a long-lived branch in; see git-workflow → Merge conflicts."
          );
        }
      }
      // A plain pull only updates the current branch from its upstream; the checks below are for
      // commands that write commits.
      if (w.sub === "pull") continue;
    }
    if (w.dir === UNKNOWN) {
      deny("Cannot determine which repository `git " + w.sub + "` runs in. Use `git -C <literal repo path> " + w.sub + " …`.");
    }
    const branch = currentBranch(w.dir);
    if (branch === null) {
      deny("`git " + w.sub + "` would run in `" + w.dir + "`, which is not a git repository. Use `git -C <repo> " + w.sub + " …`.");
    }
    // The brain records the harness's own work; committing and pushing there is the point.
    const brain = isBrainRepo(w.dir) && (w.sub === "commit" || w.sub === "push");

    if (!brain && isProtected(branch, rules)) {
      deny(
        "Refusing `git " + w.sub + "` in `" + w.dir + "` on protected branch `" + branch + "`. Create a ticket branch per the git-workflow skill first."
      );
    }
    if (w.sub === "push") {
      const p = pushDestinations(w.args);
      if (p.all) deny("Refusing to push all branches from `" + w.dir + "`; push the ticket branch explicitly.");
      if (p.forced) deny("Refusing forced refspec push (`+`) from `" + w.dir + "`.");
      if (!brain) {
        const hit = p.destinations.find((d) => isProtected(d, rules));
        if (hit) deny("Refusing to push to protected branch `" + hit + "` from `" + w.dir + "`. Push only the ticket branch.");
      }
    }
  }

  process.exit(0);
});
