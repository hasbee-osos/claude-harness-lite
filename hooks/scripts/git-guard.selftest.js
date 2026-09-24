/**
 * Self-test for git-guard's branch rules. Builds throwaway repos in a temp folder;
 * touches no real repo and makes no network call.
 *
 *   node hooks/scripts/git-guard.selftest.js
 *
 * Covers the brain exception (marker-gated commit/push on any branch), the destructive
 * operations that stay blocked there, the protected-branch behaviour of product repos, merges of
 * long-lived branches (resolve branches only), and the GitHub CLI allowlist (gh called by name or
 * by path).
 * It is not the guard's full tokenizer suite - run it after any change to the write loop.
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const GUARD = process.argv[2] || require("path").join(__dirname, "git-guard.js");
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "guard-brain-"));
let failures = 0;

function mkrepo(name, branch, marker) {
  const dir = path.join(ROOT, name);
  fs.mkdirSync(dir, { recursive: true });
  const git = (...a) => execFileSync("git", ["-C", dir, ...a], { stdio: "ignore" });
  git("init", "-q", "-b", branch);
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  fs.writeFileSync(path.join(dir, "seed.txt"), "seed");
  git("add", "-A");
  git("commit", "-qm", "seed");
  if (marker) fs.writeFileSync(path.join(dir, ".harness-brain"), "");
  return dir;
}

// Returns "ALLOW" or "DENY".
function guard(command, cwd) {
  const payload = JSON.stringify({
    tool_name: "Bash",
    tool_input: { command },
    cwd: cwd || ROOT,
  });
  let stdout = "";
  try {
    stdout = execFileSync("node", [GUARD], { input: payload, encoding: "utf8" });
  } catch (e) {
    stdout = e.stdout || "";
  }
  return /permissionDecision"\s*:\s*"deny"/.test(stdout) ? "DENY" : "ALLOW";
}

function check(name, command, expected, cwd) {
  const got = guard(command, cwd);
  if (got === expected) {
    console.log(`  PASS [${expected}] ${name}`);
  } else {
    failures++;
    console.log(`  FAIL expected ${expected}, got ${got}: ${name}\n        ${command}`);
  }
}

const brain = mkrepo("sis-brain", "main", true);
const fakeBrain = mkrepo(".brain", "main", false); // named like a brain, no marker
const product = mkrepo("sis-product-sis-admin-backend", "base-sandbox-qa", false);
const ticket = mkrepo("sis-product-sis-frontend", "base-bugfix-GSIS-1", false);

console.log("\nBrain repo (marker present, on main)");
check("commit", `git -C "${brain}" commit -m "GSIS-1: analysis"`, "ALLOW");
check("commit -am", `git -C "${brain}" commit -am "GSIS-1: evaluation 1"`, "ALLOW");
check("push origin main", `git -C "${brain}" push origin main`, "ALLOW");
check("push (no refspec)", `git -C "${brain}" push`, "ALLOW");
check("push -u origin HEAD:main", `git -C "${brain}" push -u origin HEAD:main`, "ALLOW");

console.log("\nBrain repo: destructive operations still blocked");
check("push --force", `git -C "${brain}" push --force origin main`, "DENY");
check("push -f", `git -C "${brain}" push -f origin main`, "DENY");
check("push --force-with-lease", `git -C "${brain}" push --force-with-lease`, "DENY");
check("push --all", `git -C "${brain}" push --all origin`, "DENY");
check("push --mirror", `git -C "${brain}" push --mirror origin`, "DENY");
check("push +refspec", `git -C "${brain}" push origin +main:main`, "DENY");
check("reset --hard", `git -C "${brain}" reset --hard HEAD~1`, "DENY");
check("clean -fd", `git -C "${brain}" clean -fd`, "DENY");
check("branch -D", `git -C "${brain}" branch -D main`, "DENY");
check("merge on main", `git -C "${brain}" merge origin/main`, "DENY");
check("rebase on main", `git -C "${brain}" rebase origin/main`, "DENY");

console.log("\nException is marker-gated, not name-gated");
check("folder named .brain without marker: commit", `git -C "${fakeBrain}" commit -m x`, "DENY");
check("folder named .brain without marker: push", `git -C "${fakeBrain}" push origin main`, "DENY");

console.log("\nProduct repos unchanged");
check("commit on base-sandbox-qa", `git -C "${product}" commit -m x`, "DENY");
check("push to base-sandbox-qa", `git -C "${product}" push origin base-sandbox-qa`, "DENY");
check("commit on ticket branch", `git -C "${ticket}" commit -m "GSIS-1: fix"`, "ALLOW");
check("push ticket branch", `git -C "${ticket}" push -u origin base-bugfix-GSIS-1`, "ALLOW");
check("push ticket branch to protected target", `git -C "${ticket}" push origin HEAD:base-qa`, "DENY");

console.log("\nLong-lived branches merge only into resolve branches");
const resolve = mkrepo("sis-product-sis-scheduler-service", "base/bugfix/GSIS-1-x-base-sandbox-qa-conflict-resolved", false);
const resolve2 = mkrepo("sis-product-workflow-engine-backend", "base/bugfix/GSIS-1-x-gcet-sandbox-qa-conflict-resolved-2", false);
check("merge target into ticket branch", `git -C "${ticket}" merge origin/base-sandbox-qa`, "DENY");
check("merge base-development into ticket branch", `git -C "${ticket}" merge --no-ff -m "sync" base-development`, "DENY");
check("merge refs/remotes/origin/<target> into ticket branch", `git -C "${ticket}" merge refs/remotes/origin/gcet-sandbox-qa`, "DENY");
check("pull target into ticket branch", `git -C "${ticket}" pull origin base-sandbox-qa`, "DENY");
check("merge target into resolve branch", `git -C "${resolve}" merge --no-ff origin/base-sandbox-qa`, "ALLOW");
check("merge target into resolve branch -2", `git -C "${resolve2}" merge origin/gcet-sandbox-qa`, "ALLOW");
check("merge ticket branch into resolve branch", `git -C "${resolve}" merge base/bugfix/GSIS-1-x`, "ALLOW");
check("merge another ticket branch into ticket branch", `git -C "${ticket}" merge origin/base/feature/GSIS-2-y`, "ALLOW");
check("merge --abort on ticket branch", `git -C "${ticket}" merge --abort`, "ALLOW");
check("plain pull on ticket branch", `git -C "${ticket}" pull --ff-only`, "ALLOW");
check("plain pull on protected branch", `git -C "${product}" pull --ff-only`, "ALLOW");

console.log("\nWorkspace cwd resolution still works");
check("cd into brain then commit", `cd "${brain}" && git commit -m "GSIS-1: design"`, "ALLOW");
check("cd into product then commit", `cd "${product}" && git commit -m x`, "DENY");
check("unresolvable repo", `git commit -m x`, "DENY", path.join(ROOT, "not-a-repo"));

console.log("\nReads are unaffected");
check("status in brain", `git -C "${brain}" status --porcelain`, "ALLOW");
check("log in product", `git -C "${product}" log --oneline -5`, "ALLOW");
check("pull in brain", `git -C "${brain}" pull --ff-only`, "ALLOW");
check("merge-base in product", `git -C "${product}" merge-base HEAD base-sandbox-qa`, "ALLOW");
check("merge-tree in product", `git -C "${product}" merge-tree --write-tree --name-only base-sandbox-qa HEAD`, "ALLOW");

console.log("\nGitHub CLI allowlist, by name or by path");
const GH = "C:\\Program Files\\GitHub CLI\\gh.exe";
check("gh pr merge", `gh pr merge 5`, "DENY");
check("gh auth token", `gh auth token`, "DENY");
check("gh api POST", `gh api -X POST repos/o/r/issues`, "DENY");
check("double-quoted path: pr merge", `"${GH}" pr merge 5`, "DENY");
check("PowerShell call operator: pr merge", `& '${GH}' pr merge 5`, "DENY");
check("escaped forward-slash path: pr review", `C:/Program\\ Files/GitHub\\ CLI/gh.exe pr review 5 --approve`, "DENY");
check("unix path: workflow run", `/usr/bin/gh workflow run ci.yml`, "DENY");
check("gh pr create", `gh pr create --base main --title x`, "ALLOW");
check("quoted path: pr create", `"${GH}" pr create --base main`, "ALLOW");
check("quoted path: --version", `"${GH}" --version`, "ALLOW");
check("gh pr checks", `gh pr checks 5`, "ALLOW");
check("gh api GET", `gh api repos/o/r/pulls/5/comments`, "ALLOW");

console.log("\n" + (failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"));
process.exit(failures === 0 ? 0 : 1);
