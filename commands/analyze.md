---
description: Run the Analyzer only - retrieve Jira context, inspect the repository, produce a root-cause analysis artifact
argument-hint: <jira-ticket-id-or-url>
allowed-tools: Task, Read, Write, Glob, Grep, Bash
---

# /analyze — analysis stage only

Input: `$ARGUMENTS` (Jira ticket ID or URL).

1. Extract the ticket ID. If a read-only Jira MCP is configured, load the issue context; if Jira is unavailable, stop and say so; if no MCP is configured, ask the user to paste the ticket content.
2. Check `git status` / current branch and note them, but do not create branches or change anything.
3. Dispatch the `engineering-harness:analyzer` subagent with the ticket ID and context.
4. Write the returned artifact to `.runtime/<ticket-id>/analysis.md` (create/update `.runtime/<ticket-id>/state.json` with `analysis: READY` or the NEEDS_INPUT status).
5. Present a short summary of the analysis to the user.

**Stop here.** No design, no implementation. If the analyzer returns `NEEDS_INPUT`, surface the open questions to the human.
