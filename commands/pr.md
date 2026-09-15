---
description: Prepare or create pull requests (one per changed repo and target) after evaluator PASS - never merges
argument-hint: [jira-ticket-id]
allowed-tools: Read, Write, Glob, Grep, Bash
---

# /pr — pull request stage

Input: optional `$ARGUMENTS` (Jira ticket ID). If omitted, infer from the most recent `.runtime/*/` directory.

Read the `ground-rules` skill first. Follow `workspace` (repos, `git -C`, `state.json`) and `git-workflow` (PR scope, stages, resolve branches).

1. **Gate:** read `.runtime/<ticket-id>/state.json` (or `evaluation.md`) and verify the evaluator verdict is `PASS`. If it is `FAIL`, `INSUFFICIENT_EVIDENCE`, or missing, **stop** and tell the user evaluation must pass first. Never skip this gate.
2. **Check each changed repo** in `state.json` `repos`: the current branch is `branch` (`git -C <repo> branch --show-current`), the working tree is clean (`git -C <repo> status --porcelain`), and the committed change is scoped to the ticket (`git -C <repo> log origin/<source_branch>..HEAD`, `git -C <repo> diff origin/<source_branch>...HEAD`). If `flow`, `pr_targets` or `repos` is missing, stop and ask.
3. **Determine the current stage** from `pr_targets`. If a later stage is next, ask the human to confirm the previous stage is done **in every changed repo** (all its PRs merged and verified, per `git-workflow`) before continuing.
4. **Compose the PR content per repo** following the PR format: Jira, Summary, Implementation (this repo), Tests (actual tests executed in this repo), Verification (actual evidence), Evaluator (PASS), Iterations, **Related PRs** (the same ticket's PRs in the other repos, by repo name and branch, plus URL once known, and any merge/deploy ordering from the design), Notes. In Notes, list the **next human steps** for the flow as defined in `git-workflow`.
5. **Raise one PR per changed repo × target in the current stage only** — from the ticket branch, or from that target's resolve branch if it conflicts (see Merge conflicts in `git-workflow`) — limited to the PRs `git-workflow` allows agents to raise. Use `gh pr create --repo <owner>/<repo> --base <target> --head <branch>` **only if `gh auth status` succeeds**. Otherwise use the **PR link fallback** for each repo × target:
   - Push the head branch (`git -C <repo> push -u origin <head-branch>`; never force).
   - Derive `<owner>/<repo>` from `git -C <repo> remote get-url origin`.
   - Give the human a compare link with the title prefilled: `https://github.com/<owner>/<repo>/compare/<target>...<head-branch>?expand=1&title=<url-encoded title>`.
   - Write each PR description to `.runtime/<ticket-id>/pr-<repo>-<target>.md` and show it, so the human can paste it into the PR body.
   - Present the links as one table (repo, target, head branch, link) and ask the human to reply with the PR URLs once created.
6. **Never merge a PR. Never approve it. Never bypass checks. Never force-push.** The human reviews and merges.
7. Update `state.json` `prs` with one entry per repo × target (head, resolve branch, compare link, URL once reported) and the stage status.
