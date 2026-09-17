---
description: Run the Analyzer only - retrieve Jira context, inspect the repositories, produce the analysis (root cause for a bug; gap, scope and acceptance criteria for a feature)
argument-hint: <jira-ticket-id-or-url>
allowed-tools: Task, Read, Write, Glob, Grep, Bash
---

# /analyze — analysis stage only

Input: `$ARGUMENTS` (Jira ticket ID or URL). Read the `ground-rules`, `workspace`, `brain` and `work-types` skills first. If the ticket already has a brain folder, follow the resume protocol in `brain` before doing anything else.

1. Extract the ticket ID. If a read-only Jira MCP is configured, load the issue context, including comments and attachments (download them and extract frames from screen recordings per `jira-attachments`); if Jira is unavailable, stop and say so; if no MCP is configured, ask the user to paste the ticket content.
2. Discover the workspace repos (`workspace` skill). If the ticket folder has no `state.json`, record **Ticket started** (`brain`). If `state.json` has no `work_type`/`flow`/`source_branch`, propose them (work type per `work-types`) with the branch name per `git-workflow`, **wait for the human to confirm**, and record **Work type, flow and branch confirmed**. Run `git -C <repo> fetch origin` for every repo. Do not create branches or change any checkout.
3. Dispatch the `engineering-harness:analyzer` subagent with the ticket ID, context, repo list, `source_branch` and the local attachment paths (with any that could not be read).
4. Record **Analysis written** (`brain`).
5. Present a short summary of the analysis to the user, including the repos marked change vs context.

**Stop here.** No design, no implementation. Settle the analysis's questions first (`input-packets` → "The bar"): lock assumptions as decisions and ask the developer the questions marked `developer` in the terminal. Only if a QA or SME question passes the bar, write the one short packet (`input-packets`) and show it and its path.
