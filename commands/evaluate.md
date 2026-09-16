---
description: Run the Evaluator only - independent quality gate producing PASS / FAIL / INSUFFICIENT_EVIDENCE
argument-hint: [jira-ticket-id]
allowed-tools: Task, Read, Write, Glob, Grep, Bash
---

# /evaluate — evaluation stage only

Input: optional `$ARGUMENTS` (Jira ticket ID). If omitted, infer from the most recent `.brain/tickets/*/` directory. Read the `ground-rules`, `workspace` and `brain` skills first, and resume from the brain folder if one exists.

1. Require the current `.brain/tickets/<ticket-id>/implementation-report-<iteration>.md` (see `artifacts` in `state.json`). If missing, tell the user to run `/implement` first.
2. Dispatch the `engineering-harness:evaluator` subagent with the ticket, iteration number, `state.json`, `decisions.md`, and paths to all artifacts (analysis, design, implementation report). The evaluator inspects every changed repo, its diff, the evidence, and cross-repo consistency independently.
3. Write the returned artifact to `.brain/tickets/<ticket-id>/evaluation-<iteration>.md` — never overwrite an earlier iteration — append an `evaluation` journal event with the verdict and finding counts, lock a decision record for the verdict, and update `state.json` (`evaluation: PASS|FAIL|INSUFFICIENT_EVIDENCE`, `status`, `artifacts`, `updated_at`, `next_action`).
4. Present the verdict with the per-repo results, blocking findings, and required changes (if any) to the user.

The evaluator must never modify source or tests to make an evaluation pass.
