---
description: Run the Designer only - verify the analysis and produce a technical implementation plan with regression surface and test strategy
argument-hint: [jira-ticket-id]
allowed-tools: Task, Read, Write, Glob, Grep, Bash
---

# /design — design stage only

Input: optional `$ARGUMENTS` (Jira ticket ID). If omitted, infer the ticket from the most recent `.runtime/*/analysis.md`.

1. Require `.runtime/<ticket-id>/analysis.md`. If missing, tell the user to run `/analyze` first (or provide the analysis). Do not design without an analysis.
2. Dispatch the `engineering-harness:designer` subagent with the ticket and the analysis artifact. The designer must independently verify the analysis against the repository.
3. Write the returned artifact to `.runtime/<ticket-id>/design.md` and update `state.json` (`design: READY`).
4. Present the change plan, regression surface, and test strategy summary to the user.

**Stop here.** No implementation. If the designer returns `NEEDS_INPUT`, surface the specifics to the human.
