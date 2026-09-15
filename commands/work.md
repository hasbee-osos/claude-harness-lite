---
description: Run the complete bounded bug-fix workflow for a Jira ticket across the workspace repos (analyze → design → implement → evaluate loop → PR)
argument-hint: <jira-ticket-id-or-url>
allowed-tools: Task, Read, Write, Edit, Glob, Grep, Bash
---

# /work — full bug-fix harness run

Input: `$ARGUMENTS` (a Jira ticket ID like `ABC-123` or a Jira URL).

Orchestrate the complete workflow. Use the Task tool with the plugin's subagents: `engineering-harness:analyzer`, `engineering-harness:designer`, `engineering-harness:implementor`, `engineering-harness:evaluator`. Read the `ground-rules` skill first. Follow the `workspace` skill for repo discovery, `git -C` usage, runtime location and the `state.json` schema, and `git-workflow` for flows, branches and PRs.

## MAX_ITERATIONS = 3 — never exceed this. Never loop autonomously past it.

## Workflow

1. **Validate Jira input.** Extract the ticket ID from the ID or URL. If missing/invalid, stop and ask.
2. **Load Jira context.** If a Jira MCP server is configured (read-only), use it to read the issue: summary, description, comments, linked issues. **If Jira is unavailable, stop before analysis** and explain that Jira context could not be retrieved. Never fabricate ticket content. If no Jira MCP is configured, ask the user to paste the ticket content and record that the context was manually provided.
3. **Initialize or resume.** Discover the workspace repos (`workspace`). If `.runtime/<ticket-id>/state.json` exists, resume from its recorded `status` instead of starting over. Otherwise create `.runtime/<ticket-id>/` (after the ignore check in `workspace`) with `state.json`.
4. **Flow and branch name.** Following `git-workflow` flow selection, propose the flow, branch name, source branch and PR targets per stage from the Jira context. **Wait for the human to confirm.** Record them in `state.json`. Hotfix/OSOS/dormant-line tickets: escalate.
5. **Fetch.** `git -C <repo> fetch origin` for every workspace repo, so analysis reads `origin/<source_branch>`. Do not change any checkout.
6. **Analyzer.** Dispatch `engineering-harness:analyzer` with the ticket, Jira context, repo list and `source_branch`. Write the artifact to `.runtime/<ticket-id>/analysis.md`. Update `state.json` (`analysis`, `status`). If `NEEDS_INPUT`, present the open questions and stop.
7. **Designer.** Dispatch `engineering-harness:designer` with the ticket and the analysis. Write to `.runtime/<ticket-id>/design.md`. Update `state.json`. If `NEEDS_INPUT`, stop and escalate.
8. **Confirm repos.** Show the design's repo table (change vs context) and cross-repo contracts. **Wait for the human to confirm the repos to change.** Record `repos` (role `change`) and `context_repos` in `state.json`.
9. **Create ticket branches.** For each repo to change:
   - Check `git -C <repo> status --porcelain`. If the repo has uncommitted changes, **do not overwrite, stash, or discard them** — stop and ask.
   - If the ticket branch already exists locally or on origin, reuse it (`git -C <repo> switch <branch>`).
   - Otherwise `git -C <repo> switch -c <branch> origin/<source_branch>`.
   - Set `branch_created: true` for that repo in `state.json`.
10. **Implementor.** Dispatch `engineering-harness:implementor` with the ticket, analysis, design, `state.json`, and the current iteration number. Write to `.runtime/<ticket-id>/implementation-report.md`. Update `state.json` (`implementation`, `status: EVALUATING`).
11. **Evaluator.** Dispatch `engineering-harness:evaluator` with the ticket, all artifacts, `state.json`, and the current iteration number. Write to `.runtime/<ticket-id>/evaluation.md`. Update `state.json` (`evaluation`, `status`).
12. **Branch on verdict:**
    - `PASS` → go to step 13.
    - `FAIL` or `INSUFFICIENT_EVIDENCE` → increment `iteration`. For INSUFFICIENT_EVIDENCE, first attempt to obtain the missing evidence (e.g. run the unexecuted verification) if practical. If `iteration > 3`: **STOP**, write an escalation report using `templates/escalation-report.md` to `.runtime/<ticket-id>/escalation-report.md`, present it, and end. Otherwise loop back to step 10 with only the evaluator's **blocking findings** as the implementor's iteration scope (non-blocking recommendations must not trigger a cycle).
13. **PR.** Follow the `/pr` command logic for the **first stage** in `pr_targets` only, for **every changed repo** (later stages are raised by re-running `/pr` once the human confirms the previous stage is done). **Never merge.**
14. **Publish to Jira** if the configured Jira MCP supports it: post the concise final summary (Analysis/Design/Implementation/Evaluation status, repos, iterations, PR references) and the final artifacts as comments. Do not publish intermediate agent messages or chain-of-thought. If the MCP does not support writes (or a guard blocks them), do not fake it — document the limitation and leave artifacts in `.runtime/`.

The evaluation stage may never be bypassed. Do not allow any agent to skip it.

At the end, present to the user: verdict, iteration count, per-repo PR references (or compare links and descriptions), and remaining limitations.
