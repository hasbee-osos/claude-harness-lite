---
description: Prepare or create a pull request after evaluator PASS - never merges
argument-hint: [jira-ticket-id]
allowed-tools: Read, Write, Glob, Grep, Bash
---

# /pr — pull request stage

Input: optional `$ARGUMENTS` (Jira ticket ID). If omitted, infer from the most recent `.runtime/*/` directory.

1. **Gate:** read `.runtime/<ticket-id>/state.json` (or `evaluation.md`) and verify the evaluator verdict is `PASS`. If it is `FAIL`, `INSUFFICIENT_EVIDENCE`, or missing, **stop** and tell the user evaluation must pass first. Never skip this gate.
2. Confirm the current branch is the ticket's feature branch and that the diff is scoped to the ticket (`git status`, `git diff`).
3. Compose the PR content following the PR format: Jira, Summary, Implementation, Tests (actual tests executed), Verification (actual evidence), Evaluator (PASS), Iterations, Notes.
4. **Create the PR only if a Git provider integration exists** (e.g. `gh pr create` is authenticated and the remote is GitHub). Otherwise generate the PR title and description for the engineer to use manually.
5. **Never merge the PR. Never approve it. Never bypass checks. Never force-push.** The human reviews and merges.
6. Update `state.json` with the PR reference if one was created.
