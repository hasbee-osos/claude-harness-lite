---
description: Run the Designer only - verify the analysis and produce a technical implementation plan with regression surface and test strategy
argument-hint: [jira-ticket-id]
allowed-tools: Task, Read, Write, Glob, Grep, Bash
---

# /design — design stage only

Input: optional `$ARGUMENTS` (Jira ticket ID). If omitted, pick the ticket as `brain` → "Finding the ticket when none is named" says. Read the `harness-core` and `brain` skills first, and resume from the brain folder if one exists.

1. Require the current analysis in the ticket folder (`state.json` `artifacts.analysis`). If missing, tell the user to run `/analyze` first (or provide the analysis). Do not design without an analysis.
2. Dispatch the `engineering-harness:designer` subagent with the ticket, the analysis artifact and the locked decisions in `decisions.md`. The designer must independently verify the analysis against the repository and must not contradict a locked decision without superseding it.
3. Record **Design written** (`brain`).
4. Present the repos to change, cross-repo contracts, change plan, regression surface, and test strategy summary to the user.

**Stop here.** No implementation. If the designer returns `NEEDS_INPUT`, write the input packet for the questions QA or the SME can answer (`input-packets`) and surface all the specifics to the human.
