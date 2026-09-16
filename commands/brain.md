---
description: Read the workspace brain - list recent tickets, or show one ticket's timeline, locked decisions, iteration history and metrics
argument-hint: [jira-ticket-id]
allowed-tools: Read, Glob, Grep, Bash
---

# /brain — read the workspace record

Input: optional `$ARGUMENTS` (Jira ticket ID). Read the `brain` skill first. **This command is read-only**: it never changes ticket state, never dispatches an agent, never touches a product repo. It may run `git -C sis-brain pull --rebase` to show the team's current record, and nothing else.

## With no argument — list recent work

1. `git -C sis-brain pull --rebase`, then read the last ~30 lines of `sis-brain/index.jsonl`. If it does not exist, list `sis-brain/tickets/*/state.json` instead and say the index is missing.
2. Print one row per ticket, most recent first: ticket, status, verdict, iterations, repos changed, branch, PR count, when it was last touched.
3. Show `sis-brain/current.json` if it names a ticket, as "in progress now".
4. If `sis-brain/` does not exist, say so plainly — the harness has not run in this workspace yet — and stop.

## With a ticket ID — show that ticket

`git -C sis-brain pull --rebase`, then read `sis-brain/tickets/<ticket-id>/` and present, in this order:

1. **Where it stands** — status, iteration `n of max`, and `next_action` verbatim. Anything in `blocked_on` goes here, first.
2. **Timeline** — `journal.jsonl` rendered as a readable list: timestamp, event, the fields that matter. Collapse repetitive `stage_start`/`stage_end` pairs into one line with the duration.
3. **Decisions** — every record from `decisions.md`: ID, the decision, and its status. Mark `SUPERSEDED` ones clearly. Show the full record for any the user asks about rather than printing all of them in full.
4. **Human confirmations** — what the human already approved, and when.
5. **Artifacts** — the files present, with the current one per stage marked, so the user can open the right iteration.
6. **Metrics** — from `metrics.json`: tokens by stage, wall-clock per stage, iterations, evaluator findings. Say plainly if the file is missing (telemetry may not be configured).
7. **PRs** — from `state.json` `prs`: repo, stage, target, link or compare link, and merge status as last recorded.

Close with one sentence on what a person would do next to move the ticket — but do **not** do it. Use `/work <ticket-id>` to continue the ticket.

## Notes

- If a file is missing or unparseable, say which one and carry on with the rest. A partial brain is still useful.
- Never invent a decision, verdict or metric that is not in the files. If the record does not say why something was done, the answer is "the record does not say".
