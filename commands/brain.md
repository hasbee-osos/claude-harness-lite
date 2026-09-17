---
description: Read the workspace brain - list recent tickets, show one ticket's timeline, locked decisions, iteration history and metrics, or publish the leadership dashboard
argument-hint: [jira-ticket-id | publish]
allowed-tools: Read, Glob, Grep, Bash, Artifact
---

# /brain — read the workspace record

Input: optional `$ARGUMENTS` — a Jira ticket ID, or `publish`. Read the `brain` skill first; it is the specification of every file read here. **This command never changes a ticket record**: it never changes ticket state, never dispatches an agent, never touches a product repo. It may run `git -C sis-brain pull --rebase` to show the team's current record. `publish` additionally builds the dashboard and may commit `dashboard/artifact.json`, and nothing else.

If `sis-brain/` does not exist, say so plainly — the harness has not run in this workspace yet — and stop.

## With no argument — list recent work

1. `git -C sis-brain pull --rebase`, then read the last ~30 lines of `sis-brain/index.jsonl`. If it does not exist, list the tickets' `state.json` files instead and say the index is missing.
2. Print one row per ticket, most recent first: ticket, title, sprint, status, verdict, iterations, repos changed, PR count, when it was last touched.
3. Show `sis-brain/current.json` if it names a ticket, as "in progress now".

## With a ticket ID — show that ticket

`git -C sis-brain pull --rebase`, then read the ticket folder (`brain`) and present, in this order:

1. **Where it stands** — title, epic, sprint, status, iteration `n of max`, and `next_action` verbatim. Anything in `blocked_on` goes here, first.
2. **Timeline** — `journal.jsonl` rendered as a readable list: timestamp, event, the fields that matter. Collapse repetitive `stage_start`/`stage_end` pairs into one line with the duration.
3. **Decisions** — every record from `decisions.md`: ID, the decision, and its status. Mark `SUPERSEDED` ones clearly. Show the full record for any the user asks about rather than printing all of them in full.
4. **Human confirmations** — what the human already approved, and when.
5. **Artifacts** — the files present, with the current one per stage marked, so the user can open the right iteration.
6. **Metrics** — from `metrics.json`: tokens by stage, wall-clock per stage, iterations, evaluator findings. Say plainly if the file is missing (telemetry may not be configured).
7. **PRs** — from `state.json` `prs`: repo, stage, target, link or compare link, and merge status as last recorded.

Close with one sentence on what a person would do next to move the ticket — but do **not** do it. Use `/work <ticket-id>` to continue the ticket.

## `publish` — rebuild and republish the leadership dashboard

`/work` already republishes the dashboard whenever a run stops. Use this to refresh it on demand, or to publish it for the first time.

1. `git -C sis-brain pull --rebase`.
2. If `sis-brain/dashboard/build.js` is missing, say the brain has no dashboard yet and stop.
3. Read `sis-brain/dashboard/artifact.json`.
   - **It has a `url`:** follow `brain` → Publishing. Show the build summary. If the build fails, show the error and stop. If the publish is refused because this person does not own the page, say that only the owner named in `artifact.json` can update it. Never publish a second copy.
   - **It is missing or has no `url`:** this is the first publish. Build and read the page as `brain` → Publishing says, ask the human to confirm they want to own the dashboard page, then publish the file as a new artifact with favicon `🧠` and a one-sentence description. Write `{"url": "<url>", "owner": "<display name the human gives>", "published_at": "<UTC ISO-8601>"}` to `artifact.json`, commit it as `dashboard: first publish`, and push.
4. Give the human the page link.

## Notes

- If a file is missing or unparseable, say which one and carry on with the rest. A partial brain is still useful.
- Never invent a decision, verdict or metric that is not in the files. If the record does not say why something was done, the answer is "the record does not say".
