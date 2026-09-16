---
description: Run the Designer only - verify the analysis and produce a technical implementation plan with regression surface and test strategy
argument-hint: [jira-ticket-id]
allowed-tools: Task, Read, Write, Glob, Grep, Bash
---

# /design — design stage only

Input: optional `$ARGUMENTS` (Jira ticket ID). If omitted, infer the ticket from the most recent `sis-brain/tickets/*/analysis.md`. Read the `ground-rules`, `workspace` and `brain` skills first, and resume from the brain folder if one exists.

1. Require `sis-brain/tickets/<ticket-id>/analysis.md`. If missing, tell the user to run `/analyze` first (or provide the analysis). Do not design without an analysis.
2. Dispatch the `engineering-harness:designer` subagent with the ticket, the analysis artifact and the locked decisions in `decisions.md`. The designer must independently verify the analysis against the repository and must not contradict a locked decision without superseding it.
3. Write the returned artifact to `sis-brain/tickets/<ticket-id>/design.md`, append the designer's decision records (fix approach, test strategy, any convention deviation) to `decisions.md`, and update `state.json` (`design: READY`, `artifacts`, `updated_at`, `next_action`). Journal `stage_start`/`stage_end`.
4. Present the repos to change, cross-repo contracts, change plan, regression surface, and test strategy summary to the user.

**Stop here.** No implementation. If the designer returns `NEEDS_INPUT`, write the input packet for the questions QA or the SME can answer (`input-packets`), commit and push, and surface all the specifics to the human.
