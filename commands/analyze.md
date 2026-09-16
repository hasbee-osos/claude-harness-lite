---
description: Run the Analyzer only - retrieve Jira context, inspect the repository, produce a root-cause analysis artifact
argument-hint: <jira-ticket-id-or-url>
allowed-tools: Task, Read, Write, Glob, Grep, Bash
---

# /analyze — analysis stage only

Input: `$ARGUMENTS` (Jira ticket ID or URL). Read the `ground-rules`, `workspace` and `brain` skills first. If the ticket already has a brain folder, follow the resume protocol in `brain` before doing anything else.

1. Extract the ticket ID. If a read-only Jira MCP is configured, load the issue context, including comments and attachments (download them and extract frames from screen recordings per `jira-attachments`); if Jira is unavailable, stop and say so; if no MCP is configured, ask the user to paste the ticket content.
2. Discover the workspace repos (`workspace` skill). If `sis-brain/tickets/<ticket-id>/state.json` has no `flow`/`source_branch`, propose them with the branch name per `git-workflow` and **wait for the human to confirm**; record them in `state.json` and in `human_confirmations`, and lock a decision record for the flow choice (after the ignore check in `brain`). Run `git -C <repo> fetch origin` for every repo. Do not create branches or change any checkout.
3. Dispatch the `engineering-harness:analyzer` subagent with the ticket ID, context, repo list, `source_branch` and the local attachment paths (with any that could not be read).
4. Write the returned artifact to `sis-brain/tickets/<ticket-id>/analysis.md`, lock a decision record for the root cause, and update `state.json` (`analysis: READY` or the NEEDS_INPUT status, plus `artifacts`, `updated_at` and `next_action`). Journal `stage_start`/`stage_end` around the dispatch.
5. Present a short summary of the analysis to the user, including the repos marked change vs context.

**Stop here.** No design, no implementation. If the analyzer returns `NEEDS_INPUT`, write the input packet (`input-packets`: `qa-packet.md` for a Bug, `sme-packet.md` for a Story/Task/Feature), commit and push, and surface the open questions and the packet path to the human.
