---
description: Run the Implementor only - implement the design, add tests, run verification, produce an evidence-based implementation report
argument-hint: [jira-ticket-id]
allowed-tools: Task, Read, Write, Edit, Glob, Grep, Bash
---

# /implement — implementation stage only

Input: optional `$ARGUMENTS` (Jira ticket ID). If omitted, infer from the most recent `sis-brain/tickets/*/` directory. Read the `ground-rules`, `workspace` and `brain` skills first, and resume from the brain folder if one exists.

1. Require `sis-brain/tickets/<ticket-id>/analysis.md` and `sis-brain/tickets/<ticket-id>/design.md`. If missing, tell the user to run `/analyze` and `/design` first.
2. Require `repos` in `state.json`. If missing, show the design's repo table, **wait for the human to confirm the repos to change**, and create the ticket branches as in `/work` steps 8–9. Then confirm, for each changed repo, that the current branch (`git -C <repo> branch --show-current`) is the ticket branch recorded in `state.json` and not a protected branch per `git-workflow`. If not, stop and ask the human — do not switch branches automatically when work could be lost.
3. Write `sis-brain/current.json`, then dispatch the `engineering-harness:implementor` subagent with the ticket, both artifacts, `decisions.md`, `state.json`, and `iteration: 1` (or the current iteration from `state.json`).
4. Write the returned report to `sis-brain/tickets/<ticket-id>/implementation-report-<iteration>.md` — never overwrite an earlier iteration — record any convention deviation as a decision, and update `state.json` (`implementation: COMPLETE`, `status`, `artifacts`, `updated_at`, `next_action`). Journal `stage_start`/`stage_end`.
5. Summarize per repo: what changed, tests executed with actual evidence; then cross-repo consistency, deviations from the design, and any findings.

**Stop here.** Never merge, never push to protected branches, never bypass the evaluator.
