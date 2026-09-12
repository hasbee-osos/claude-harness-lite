---
description: Run the Implementor only - implement the design, add tests, run verification, produce an evidence-based implementation report
argument-hint: [jira-ticket-id]
allowed-tools: Task, Read, Write, Edit, Glob, Grep, Bash
---

# /implement — implementation stage only

Input: optional `$ARGUMENTS` (Jira ticket ID). If omitted, infer from the most recent `.runtime/*/` directory.

1. Require `.runtime/<ticket-id>/analysis.md` and `.runtime/<ticket-id>/design.md`. If missing, tell the user to run `/analyze` and `/design` first.
2. Confirm the current branch is a dedicated ticket branch (e.g. `feature/<ticket-id>`), not a protected branch. If not, stop and ask the human — do not switch branches automatically when work could be lost.
3. Dispatch the `engineering-harness:implementor` subagent with the ticket, both artifacts, and `iteration: 1` (or the current iteration from `state.json`).
4. Write the returned report to `.runtime/<ticket-id>/implementation-report.md` and update `state.json` (`implementation: COMPLETE`, `status`).
5. Summarize: what changed, tests executed with actual evidence, deviations from the design, and any findings.

**Stop here.** Never merge, never push to protected branches, never bypass the evaluator.
