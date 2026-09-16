---
description: Run the complete bounded delivery workflow for a Jira bug or story across the workspace repos (analyze → design → implement → evaluate loop → PR)
argument-hint: <jira-ticket-id-or-url>
allowed-tools: Task, Read, Write, Edit, Glob, Grep, Bash
---

# /work — full harness run for a bug or a feature

Input: `$ARGUMENTS` (a Jira ticket ID like `ABC-123` or a Jira URL).

Orchestrate the complete workflow. Use the Task tool with the plugin's subagents: `engineering-harness:analyzer`, `engineering-harness:designer`, `engineering-harness:implementor`, `engineering-harness:evaluator`. Read the `ground-rules` and `work-types` skills first. Follow the `workspace` skill for repo discovery and `git -C` usage, the `brain` skill for the record (layout, `state.json`, journal events, decision records, resume protocol), and `git-workflow` for flows, branches and PRs.

## MAX_ITERATIONS = 3 — never exceed this. Never loop autonomously past it.

## Recording as you go

This is not optional bookkeeping. It is what lets the next session continue the ticket, and what explains the change months later when the ticket is reopened or extended.

- **Journal.** Append a `stage_start` before every stage and a `stage_end` after it, plus the event for whatever happened (`human_confirmed`, `decision_locked`, `branch_created`, `evaluation`, `pr_prepared`, `escalated`). Never rewrite a journal line.
- **Decisions.** Write a decision record (`templates/decision-record.md`) for every choice listed in `brain` — flow and branch, work type, repos to change, root cause (bug) or scope and acceptance criteria (feature), fix or design approach, test strategy, convention deviations, evaluator verdict. Cite IDs in later stages. To change course, supersede; never silently contradict.
- **`state.json`.** Update `status`, `updated_at` and **`next_action` in plain words** on every transition, so an interrupted run resumes from a cold session.
- **Sync the brain.** `git -C sis-brain pull --rebase` before reading state, then **commit and push at every milestone** (analysis written, design and repos confirmed, branches created, each evaluation, PRs prepared, ticket closed) with the message `<TICKET-ID>: <milestone>`. If a push is rejected, `pull --rebase` and retry; never force. Details in `brain`.
- **`current.json`.** Overwrite `<workspace>/sis-brain/current.json` with `{ticket, stage, iteration, started_at, session_id}` immediately before each agent dispatch, and write `{}` when the run stops. Telemetry attribution depends on it.
- **Artifacts are numbered per iteration** — `implementation-report-<n>.md`, `evaluation-<n>.md`. Never overwrite a previous iteration.

## Workflow

1. **Validate Jira input.** Extract the ticket ID from the ID or URL. If missing/invalid, stop and ask.
2. **Load Jira context.** If a Jira MCP server is configured (read-only), use it to read the issue: summary, description, comments (`executeRead` → `listJiraIssueComments`), linked issues. **If Jira is unavailable, stop before analysis** and explain that Jira context could not be retrieved. Never fabricate ticket content. If no Jira MCP is configured, ask the user to paste the ticket content and record that the context was manually provided.
   - **Attachments.** If the issue has attachments, follow `jira-attachments`: list them, download them, extract frames from every screen recording, and keep the local paths for the Analyzer. Do this before analysis, not on demand. If an attachment cannot be read, carry on and pass the failure to the Analyzer so it is recorded.
3. **Initialize or resume.** Discover the workspace repos (`workspace`).
   - `git -C sis-brain pull --rebase` first, so the record includes what colleagues have pushed. If `sis-brain` is missing or is not a git repo, stop and ask the human to clone the brain repo.
   - If `sis-brain/tickets/<ticket-id>/state.json` exists, follow the **resume protocol** in `brain`: read state, journal tail and decisions; present the resume summary (status, iteration, `next_action`, locked decisions, confirmations already given, anything in `blocked_on`); append `session_resumed`; continue from `status`. **Do not re-ask a confirmation already in `human_confirmations`** — replay it and let the human override. If `blocked_on` names a QA or SME packet, read the answers from the ticket's Jira comments and confirm them with the human before continuing (`input-packets`).
   - Ensure the workspace has a root `.ignore` containing `sis-brain/` (create or append per `brain`), so harness records stay out of code searches.
   - Otherwise create `sis-brain/tickets/<ticket-id>/`, seed any missing repo-root files per `brain` (`.harness-brain`, `README.md` from `templates/brain-readme.md`, `.gitignore`, `.gitattributes`), write `state.json`, append `ticket_started`, then commit and push.
4. **Work type, flow and branch name.** Propose the work type from the Jira issue type (`work-types`: Bug → bug; Story/Task/Improvement → feature; Sub-task → parent's; Epic → ask for a story or bug instead), and, following `git-workflow` flow selection, the flow, branch name (`bugfix` or `feature`), source branch and PR targets per stage. **Wait for the human to confirm.** Record the confirmation in `human_confirmations`, write the values (including `work_type`) into `state.json`, and lock a decision record for the flow choice that states the work type. Hotfix/OSOS/dormant-line tickets: escalate.
5. **Fetch.** `git -C <repo> fetch origin` for every workspace repo, so analysis reads `origin/<source_branch>`. Do not change any checkout.
6. **Analyzer.** Dispatch `engineering-harness:analyzer` with the ticket, Jira context, repo list, `source_branch`, and the local attachment paths (images, documents, frame folders, plus any attachment that could not be read, with the reason). Pass the `work_type`. Write the artifact to `sis-brain/tickets/<ticket-id>/analysis.md`. Lock a decision for the root cause (bug) or the scope and acceptance criteria (feature); a feature whose criteria are still draft is locked only once the SME confirms them. Update `state.json` (`analysis`, `status`, `artifacts`, `next_action`). If `NEEDS_INPUT`, write the input packet (`input-packets`: `qa-packet.md` for a Bug, `sme-packet.md` for a Story/Task/Feature), commit and push, present the open questions and the packet path, and stop.
7. **Designer.** Dispatch `engineering-harness:designer` with the ticket, `work_type`, the analysis and the locked decisions. Write to `sis-brain/tickets/<ticket-id>/design.md`. Append the designer's decision records to `decisions.md`. Update `state.json`. If `NEEDS_INPUT`, write the input packet for the questions QA or the SME can answer (`input-packets`), commit and push, present all open questions (developer-only ones in the terminal), and stop.
8. **Confirm repos.** Show the design's repo table (change vs context) and cross-repo contracts. **Wait for the human to confirm the repos to change.** Record `repos` (role `change`) and `context_repos` in `state.json`, append `human_confirmed`, and lock a decision for the repo set.
9. **Create ticket branches.** For each repo to change:
   - Check `git -C <repo> status --porcelain`. If the repo has uncommitted changes, **do not overwrite, stash, or discard them** — stop and ask.
   - If the ticket branch already exists locally or on origin, reuse it (`git -C <repo> switch <branch>`).
   - Otherwise `git -C <repo> switch -c <branch> origin/<source_branch>`.
   - Set `branch_created: true` for that repo in `state.json` and append `branch_created`.
10. **Implementor.** Dispatch `engineering-harness:implementor` with the ticket, analysis, design, `decisions.md`, `state.json`, and the current iteration number. Write to `sis-brain/tickets/<ticket-id>/implementation-report-<iteration>.md`. Record any convention deviation as a decision. Update `state.json` (`implementation`, `artifacts`, `status: EVALUATING`).
11. **Evaluator.** Dispatch `engineering-harness:evaluator` with the ticket, all artifacts, `decisions.md`, `state.json`, and the current iteration number. Write to `sis-brain/tickets/<ticket-id>/evaluation-<iteration>.md`. Append an `evaluation` journal event with the verdict and finding counts, lock a decision for the verdict, and update `state.json` (`evaluation`, `artifacts`, `status`, `next_action`).
12. **Branch on verdict:**
    - `PASS` → go to step 13.
    - `FAIL` or `INSUFFICIENT_EVIDENCE` → increment `iteration` and append `iteration_start` with the reason. For INSUFFICIENT_EVIDENCE, first attempt to obtain the missing evidence (e.g. run the unexecuted verification) if practical. If `iteration > 3`: **STOP**, write an escalation report using `templates/escalation-report.md` to `sis-brain/tickets/<ticket-id>/escalation-report.md`, append `escalated`, set `status: ESCALATED` with a `next_action`, present it, and end. Otherwise loop back to step 10 with only the evaluator's **blocking findings** as the implementor's iteration scope (non-blocking recommendations must not trigger a cycle).
13. **PR.** Follow the `/pr` command logic for the **first stage** in `pr_targets` only, for **every changed repo** (later stages are raised by re-running `/pr` once the human confirms the previous stage is done). Append `pr_prepared` per repo and target. **Never merge.**
14. **Publish to Jira** if the configured Jira MCP supports it: post the concise final summary (Analysis/Design/Implementation/Evaluation status, repos, iterations, PR references) and the final artifacts as comments. Do not publish intermediate agent messages or chain-of-thought. If the MCP does not support writes (or a guard blocks them), do not fake it — document the limitation and leave artifacts in the brain.
15. **Close the run.** Append a line to `sis-brain/index.jsonl` (ticket, status, verdict, iterations, repos, branch, PR count), set `next_action` to what the human does next, write `{}` to `sis-brain/current.json`, then commit and push the brain one last time.

The evaluation stage may never be bypassed. Do not allow any agent to skip it.

At the end, present to the user: verdict, iteration count, per-repo PR references (or compare links and descriptions), and remaining limitations.
