---
description: Run the Evaluator only - independent quality gate producing PASS / FAIL / INSUFFICIENT_EVIDENCE
argument-hint: [jira-ticket-id]
allowed-tools: Task, Read, Write, Glob, Grep, Bash
---

# /evaluate — evaluation stage only

Input: optional `$ARGUMENTS` (Jira ticket ID). If omitted, infer from the most recent `.runtime/*/` directory.

1. Require `.runtime/<ticket-id>/implementation-report.md`. If missing, tell the user to run `/implement` first.
2. Dispatch the `engineering-harness:evaluator` subagent with the ticket, iteration number, and paths to all artifacts (analysis, design, implementation report). The evaluator inspects the repository, the diff, and evidence independently.
3. Write the returned artifact to `.runtime/<ticket-id>/evaluation.md` and update `state.json` (`evaluation: PASS|FAIL|INSUFFICIENT_EVIDENCE`, `status`).
4. Present the verdict, blocking findings, and required changes (if any) to the user.

The evaluator must never modify source or tests to make an evaluation pass.
