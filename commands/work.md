---
description: Run the complete bounded delivery workflow for a Jira bug or story across the workspace repos (analyze → design → implement → evaluate loop → PR)
argument-hint: <jira-ticket-id-or-url>
allowed-tools: Task, Read, Write, Edit, Glob, Grep, Bash, Artifact
---

# /work — full harness run for a bug or a feature

Input: `$ARGUMENTS` (a Jira ticket ID like `ABC-123` or a Jira URL).

Orchestrate the complete workflow. Use the Task tool with the plugin's subagents: `engineering-harness:analyzer`, `engineering-harness:designer`, `engineering-harness:implementor`, `engineering-harness:evaluator`. Read the `ground-rules` and `work-types` skills first. Follow the `workspace` skill for repo discovery and `git -C` usage, the `brain` skill for the record (layout, `state.json`, journal events, decision records, resume protocol), and `git-workflow` for flows, branches and PRs.

## MAX_ITERATIONS = 3 — never exceed this. Never loop autonomously past it.

## Recording as you go

This is not optional bookkeeping. It is what lets the next session continue the ticket, what explains the change months later, and what the leadership dashboard is built from.

**Everything the run writes to the brain — files, journal events, `state.json` fields, `index.jsonl` lines, `current.json`, commits and pushes — is specified once, in `brain` → "What each stage records".** The steps below name the moment in **bold**; record it exactly as that table says. Decision records and their locking rules are in `brain` too.

Whenever the run stops — at any step, including a `NEEDS_INPUT` stop or an escalation, not only step 15 — record **Run stops**. Its last part republishes the leadership dashboard (`brain` → Publishing); that is best-effort and never changes the run's outcome.

## Workflow

1. **Validate Jira input.** Extract the ticket ID from the ID or URL. If missing/invalid, stop and ask.
2. **Load Jira context.** If a Jira MCP server is configured (read-only), use it to read the issue: summary, description, comments (`executeRead` → `listJiraIssueComments`), linked issues. **If Jira is unavailable, stop before analysis** and explain that Jira context could not be retrieved. Never fabricate ticket content. If no Jira MCP is configured, ask the user to paste the ticket content and record that the context was manually provided.
   - **Attachments.** If the issue has attachments, follow `jira-attachments`: list them, download them, extract frames from every screen recording, and keep the local paths for the Analyzer. Do this before analysis, not on demand. If an attachment cannot be read, carry on and pass the failure to the Analyzer so it is recorded.
3. **Initialize or resume.** Discover the workspace repos (`workspace`).
   - `git -C sis-brain pull --rebase` first, so the record includes what colleagues have pushed. If `sis-brain` is missing or is not a git repo, stop and ask the human to clone the brain repo.
   - If the ticket folder already has a `state.json`, follow the **resume protocol** in `brain` and continue from `status`. **Do not re-ask a confirmation already in `human_confirmations`** — replay it and let the human override. If `blocked_on` names a QA or SME packet, read the answers from the ticket's Jira comments and confirm them with the human before continuing (`input-packets`).
   - Ensure the workspace `.ignore` per `brain`.
   - Otherwise seed the brain if needed and record **Ticket started**, including the `jira` block from the context loaded in step 2.
4. **Work type, flow and branch name.** Propose the work type from the Jira issue type (`work-types`: Bug → bug; Story/Task/Improvement → feature; Sub-task → parent's; Epic → ask for a story or bug instead), and, following `git-workflow` flow selection, the flow, branch name (`bugfix` or `feature`), source branch and PR targets per stage. **Wait for the human to confirm**, then record **Work type, flow and branch confirmed**. Hotfix/OSOS/dormant-line tickets: escalate.
5. **Fetch.** `git -C <repo> fetch origin` for every workspace repo, so analysis reads `origin/<source_branch>`. Do not change any checkout.
6. **Analyzer.** Dispatch `engineering-harness:analyzer` with the ticket, Jira context, repo list, `source_branch`, and the local attachment paths (images, documents, frame folders, plus any attachment that could not be read, with the reason). Pass the `work_type`. Record **Analysis written**; a feature whose criteria are still draft gets its scope decision locked only once the SME confirms them. If `NEEDS_INPUT`, write the input packet (`input-packets`), present the open questions and the packet path, and stop.
7. **Designer.** Dispatch `engineering-harness:designer` with the ticket, `work_type`, the analysis and the locked decisions. Record **Design written**. If `NEEDS_INPUT`, write the input packet for the questions QA or the SME can answer (`input-packets`), present all open questions (developer-only ones in the terminal), and stop.
8. **Confirm repos.** Show the design's repo table (change vs context) and cross-repo contracts. **Wait for the human to confirm the repos to change**, then record **Repos confirmed**.
9. **Create ticket branches.** For each repo to change:
   - Check `git -C <repo> status --porcelain`. If the repo has uncommitted changes, **do not overwrite, stash, or discard them** — stop and ask.
   - If the ticket branch already exists locally or on origin, reuse it (`git -C <repo> switch <branch>`).
   - Otherwise `git -C <repo> switch -c <branch> origin/<source_branch>`.
   - Record **Branch created or reused**.
10. **Implementor.** Dispatch `engineering-harness:implementor` with the ticket, analysis, design, `decisions.md`, `state.json`, and the current iteration number. Record **Implementation reported**.
11. **Evaluator.** Dispatch `engineering-harness:evaluator` with the ticket, all artifacts, `decisions.md`, `state.json`, and the current iteration number. Record **Evaluation returned**.
12. **Branch on verdict:**
    - `PASS` → go to step 13.
    - `FAIL` or `INSUFFICIENT_EVIDENCE` → record **New iteration** with the reason. For INSUFFICIENT_EVIDENCE, first attempt to obtain the missing evidence (e.g. run the unexecuted verification) if practical. If `iteration > 3`: **STOP**, write the escalation report from `templates/escalation-report.md`, record **Escalated**, present it, and end. Otherwise loop back to step 10 with only the evaluator's **blocking findings** as the implementor's iteration scope (non-blocking recommendations must not trigger a cycle).
13. **PR.** Follow the `/pr` command logic for the **first stage** in `pr_targets` only, for **every changed repo** (later stages are raised by re-running `/pr` once the human confirms the previous stage is done). Record **PRs prepared**. **Never merge.**
14. **Publish to Jira** if the configured Jira MCP supports it: post the concise final summary (Analysis/Design/Implementation/Evaluation status, repos, iterations, PR references) and the final artifacts as comments. Do not publish intermediate agent messages or chain-of-thought. If the MCP does not support writes (or a guard blocks them), do not fake it — document the limitation and leave the record in the brain.
15. **Close the run.** Record **Run stops**, with `next_action` saying what the human does next, and republish the dashboard as part of it.

The evaluation stage may never be bypassed. Do not allow any agent to skip it.

At the end, present to the user: verdict, iteration count, per-repo PR references (or compare links and descriptions), and remaining limitations.
