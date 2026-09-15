---
description: Run the Analyzer only - retrieve Jira context, inspect the repository, produce a root-cause analysis artifact
argument-hint: <jira-ticket-id-or-url>
allowed-tools: Task, Read, Write, Glob, Grep, Bash
---

# /analyze — analysis stage only

Input: `$ARGUMENTS` (Jira ticket ID or URL). Read the `ground-rules` and `workspace` skills first.

1. Extract the ticket ID. If a read-only Jira MCP is configured, load the issue context; if Jira is unavailable, stop and say so; if no MCP is configured, ask the user to paste the ticket content.
2. Discover the workspace repos (`workspace` skill). If `.runtime/<ticket-id>/state.json` has no `flow`/`source_branch`, propose them with the branch name per `git-workflow` and **wait for the human to confirm**; record them in `state.json` (after the ignore check in `workspace`). Run `git -C <repo> fetch origin` for every repo. Do not create branches or change any checkout.
3. Dispatch the `engineering-harness:analyzer` subagent with the ticket ID, context, repo list and `source_branch`.
4. Write the returned artifact to `.runtime/<ticket-id>/analysis.md` (create/update `.runtime/<ticket-id>/state.json` with `analysis: READY` or the NEEDS_INPUT status).
5. Present a short summary of the analysis to the user, including the repos marked change vs context.

**Stop here.** No design, no implementation. If the analyzer returns `NEEDS_INPUT`, surface the open questions to the human.
