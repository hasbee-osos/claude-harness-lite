/**
 * Self-test for git-guard's branch rules. Builds throwaway repos in a temp folder;
 * touches no real repo and makes no network call.
 *
 *   node hooks/scripts/git-guard.selftest.js
 *
 * Covers the brain exception (marker-gated commit/push on any branch), the destructive
 * operations that stay blocked there, and the protected-branch behaviour of product repos.
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

console.log("\nWorkspace cwd resolution still works");
check("cd into brain then commit", `cd "${brain}" && git commit -m "GSIS-1: design"`, "ALLOW");
check("cd into product then commit", `cd "${product}" && git commit -m x`, "DENY");
check("unresolvable repo", `git commit -m x`, "DENY", path.join(ROOT, "not-a-repo"));

console.log("\nReads are unaffected");
check("status in brain", `git -C "${brain}" status --porcelain`, "ALLOW");
check("log in product", `git -C "${product}" log --oneline -5`, "ALLOW");
check("pull in brain", `git -C "${brain}" pull --ff-only`, "ALLOW");

console.log("\n" + (failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"));
process.exit(failures === 0 ? 0 : 1);
