---
description: Run the Evaluator only - independent quality gate producing PASS / FAIL / INSUFFICIENT_EVIDENCE
argument-hint: [jira-ticket-id]
allowed-tools: Task, Read, Write, Glob, Grep, Bash
---

# /evaluate — evaluation stage only

Input: optional `$ARGUMENTS` (Jira ticket ID). If omitted, pick the ticket as `brain` → "Finding the ticket when none is named" says. Read the `harness-core` and `brain` skills first, and resume from the brain folder if one exists.

1. Require the current implementation report in the ticket folder (`state.json` `artifacts.implementation`). If missing, tell the user to run `/implement` first.
2. Dispatch the `engineering-harness:evaluator` subagent with the ticket, iteration number, `state.json`, `decisions.md`, and paths to all artifacts (analysis, design, implementation report). The evaluator inspects every changed repo, its diff, the evidence, and cross-repo consistency independently.
3. Record **Evaluation returned** (`brain`).
4. Present the verdict with the per-repo results, blocking findings, and required changes (if any) to the user.

The evaluator must never modify source or tests to make an evaluation pass.
