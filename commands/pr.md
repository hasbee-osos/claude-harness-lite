---
description: Prepare or create a pull request after evaluator PASS - never merges
argument-hint: [jira-ticket-id]
allowed-tools: Read, Write, Glob, Grep, Bash
---

# /pr — pull request stage

Input: optional `$ARGUMENTS` (Jira ticket ID). If omitted, infer from the most recent `.runtime/*/` directory.

1. **Gate:** read `.runtime/<ticket-id>/state.json` (or `evaluation.md`) and verify the evaluator verdict is `PASS`. If it is `FAIL`, `INSUFFICIENT_EVIDENCE`, or missing, **stop** and tell the user evaluation must pass first. Never skip this gate.
2. Confirm the current branch matches `branch` in `state.json` and that the diff is scoped to the ticket (`git status`, `git diff`). If `flow` or `pr_targets` is missing, stop and ask — follow the `git-workflow` skill.
3. Compose the PR content following the PR format: Jira, Summary, Implementation, Tests (actual tests executed), Verification (actual evidence), Evaluator (PASS), Iterations, Notes. In Notes, list the **next human steps** for the flow as defined in `git-workflow`.
4. Determine the **current stage** from `pr_targets` in `state.json`. If a later stage is next, ask the human to confirm the previous stage is done (per `git-workflow`) before continuing. Raise **one PR per target in the current stage only** (e.g. `gh pr create --base <target> --head <branch>`) — from the ticket branch, or from that target's resolve branch if it conflicts (see Merge conflicts in `git-workflow`) — limited to the PRs `git-workflow` allows agents to raise — **only if `gh auth status` succeeds**. Otherwise use the **PR link fallback**:
   - Push the head branch (`git push -u origin <branch>`; never force).
   - Derive `<owner>/<repo>` from `git remote get-url origin`.
   - For each target, give the human a compare link with the title prefilled: `https://github.com/<owner>/<repo>/compare/<target>...<head-branch>?expand=1&title=<url-encoded title>`.
   - Write each PR description to `.runtime/<ticket-id>/pr-<target>.md` and show it, so the human can paste it into the PR body.
   - Ask the human to reply with the PR URL(s) once created.
5. **Never merge the PR. Never approve it. Never bypass checks. Never force-push.** The human reviews and merges.
6. Update `state.json` with every PR reference created (or, in the fallback, the compare links and any PR URLs the human reports back).
