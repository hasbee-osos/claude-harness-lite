---
description: Run the complete bounded bug-fix workflow for a Jira ticket (analyze → design → implement → evaluate loop → PR)
argument-hint: <jira-ticket-id-or-url>
allowed-tools: Task, Read, Write, Edit, Glob, Grep, Bash
---

# /work — full bug-fix harness run

Input: `$ARGUMENTS` (a Jira ticket ID like `ABC-123` or a Jira URL).

Orchestrate the complete workflow. Use the Task tool with the plugin's subagents: `engineering-harness:analyzer`, `engineering-harness:designer`, `engineering-harness:implementor`, `engineering-harness:evaluator`.

## MAX_ITERATIONS = 3 — never exceed this. Never loop autonomously past it.

## Workflow

1. **Validate Jira input.** Extract the ticket ID from the ID or URL. If missing/invalid, stop and ask.
2. **Load Jira context.** If a Jira MCP server is configured (read-only), use it to read the issue: summary, description, comments, linked issues. **If Jira is unavailable, stop before analysis** and explain that Jira context could not be retrieved. Never fabricate ticket content. If no Jira MCP is configured, ask the user to paste the ticket content and record that the context was manually provided.
3. **Inspect repository state.** Run `git status` and `git branch --show-current`.
   - If the working tree is dirty with unrelated user changes: **do not overwrite, stash, or discard them.** Stop and ask for human direction.
   - If on a protected branch (main/master/develop/development/release/*): create and switch to `feature/<ticket-id>`. If that could destroy work, stop and ask.
   - If already on a branch for this ticket, reuse it.
4. **Initialize runtime state.** Create `.runtime/<ticket-id>/` with `state.json` (fields: `ticket`, `status`, `iteration`, `max_iterations: 3`, `analysis`, `design`, `implementation`, `evaluation`). If a previous run's `.runtime/<ticket-id>/` exists, resume from its recorded status instead of starting over.
5. **Analyzer.** Dispatch `engineering-harness:analyzer` with the ticket ID and Jira context. Write the returned artifact to `.runtime/<ticket-id>/analysis.md`. Update `state.json` (`analysis`, `status`). If status is `NEEDS_INPUT`, present the open questions to the human and stop.
6. **Designer.** Dispatch `engineering-harness:designer` with the ticket and the analysis artifact. Write to `.runtime/<ticket-id>/design.md`. Update `state.json`. If `NEEDS_INPUT`, stop and escalate to the human.
7. **Implementor.** Dispatch `engineering-harness:implementor` with the ticket, analysis, and design artifacts, plus the current iteration number. Write to `.runtime/<ticket-id>/implementation-report.md`. Update `state.json` (`implementation`, `status: EVALUATING`).
8. **Evaluator.** Dispatch `engineering-harness:evaluator` with the ticket, all artifacts, and the current iteration number. Write to `.runtime/<ticket-id>/evaluation.md`. Update `state.json` (`evaluation`, `status`).
9. **Branch on verdict:**
   - `PASS` → go to step 10.
   - `FAIL` or `INSUFFICIENT_EVIDENCE` → increment `iteration`. For INSUFFICIENT_EVIDENCE, first attempt to obtain the missing evidence (e.g. run the unexecuted verification) if practical. If `iteration > 3`: **STOP**, write an escalation report using `templates/escalation-report.md` to `.runtime/<ticket-id>/escalation-report.md`, present it, and end. Otherwise loop back to step 7 with only the evaluator's **blocking findings** as the implementor's iteration scope (non-blocking recommendations must not trigger a cycle).
10. **PR.** Follow the `/pr` command logic: verify `evaluation: PASS` in `state.json`, then create a PR if a Git provider integration (e.g. `gh`) is available; otherwise generate the PR description for the engineer. **Never merge.**
11. **Publish to Jira** if the configured Jira MCP supports it: post the concise final summary (Analysis/Design/Implementation/Evaluation status, iterations, PR reference) and the final artifacts as comments. Do not publish intermediate agent messages or chain-of-thought. If the MCP does not support writes/attachments, do not fake it — document the limitation and leave artifacts in `.runtime/`.

The evaluation stage may never be bypassed. Do not allow any agent to skip it.

At the end, present to the user: verdict, iteration count, PR reference or PR description, and remaining limitations.
