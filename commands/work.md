---
description: Move a Jira bug or story forward from wherever it stands - plan, implement, evaluate, raise PRs - resuming from the brain, on the light or full track
argument-hint: <jira-ticket-id-or-url> [plan]
allowed-tools: Task, Read, Write, Edit, Glob, Grep, Bash, Artifact
---

# /work — the one command that moves a ticket

Input: `$ARGUMENTS` — a Jira ticket ID like `ABC-123` or a Jira URL, optionally followed by `plan` to stop once the plan is written (a cheap check of the root cause or scope and the repos before a full run). With no ticket, pick one as `brain` → "Finding the ticket when none is named" says.

`/work` is safe to re-run at any time: it reads the ticket's record and does the next thing. Use the Task tool with the plugin's subagents `engineering-harness:planner`, `engineering-harness:implementor` and `engineering-harness:evaluator`. Read the `harness-core` skill first. Follow its Workspace section for repo discovery and `git -C` usage, `brain` for the record (layout, `state.json`, journal events, decision records, resume protocol), and `git-workflow` for flows, branches and PRs.

## Recording as you go

This is not optional bookkeeping. It is what lets the next session continue the ticket, what explains the change months later, and what the leadership dashboard is built from.

**Everything the run writes to the brain — files, journal events, `state.json` fields, `index.jsonl` lines, `current.json`, commits and pushes — is specified once, in `brain` → "What each stage records".** The steps below name the moment in **bold**; record it exactly as that table says. Decision records and their locking rules are in `brain` too.

When a plan or an implementation report includes **Codebase map corrections**, apply them as `brain` → Codebase map says, right after recording that artifact.

Whenever the run stops — at any step, including a `NEEDS_INPUT` stop or an escalation — record **Run stops**. Its last part republishes the leadership dashboard (`brain` → Publishing); that is best-effort and never changes the run's outcome.

## Starting or resuming

1. **Validate the input.** Extract the ticket ID from the ID or URL. If it is missing or invalid, stop and ask.
2. **Load Jira context.** Read the issue through the read-only Jira MCP: summary, description, comments (`executeRead` → `listJiraIssueComments`), linked issues. **If Jira is unavailable, stop** and explain that the context could not be retrieved. Never fabricate ticket content. If no Jira MCP is configured, ask the user to paste the ticket and record that it was provided manually.
   - **Attachments** (only when the plan still has to be written): follow `jira-attachments` — list, download, extract frames from every screen recording, and keep the local paths for the Planner. If one cannot be read, carry on and pass the failure to the Planner.
3. **Initialize or resume.** Discover the workspace repos (`harness-core` → Workspace). Run `git -C sis-brain pull --rebase` first; if `sis-brain` is missing or not a git repo, stop and ask the human to clone it. Ensure the workspace `.ignore` per `brain`.
   - **No `state.json`:** seed the brain if needed, record **Ticket started** with the `jira` block, and go to step 4.
   - **`state.json` exists:** follow the **resume protocol** in `brain`, then continue from `status`. **Never re-ask a confirmation already in `human_confirmations`** — replay it and let the human override.

   | `status` | Continue at |
   |---|---|
   | `PLANNING` | step 6 |
   | `NEEDS_INPUT` | read the answers from the ticket's Jira comments and confirm them with the human (`input-packets`), then step 6 |
   | `AWAITING_REPO_CONFIRMATION` | step 7 |
   | `IMPLEMENTING` | step 9 |
   | `EVALUATING` | step 10 |
   | `ESCALATED` | show the escalation report and ask the human: move to the full track (light only), start another round with their guidance, or stop |
   | `PR_STAGE_<n>` | if a changed repo's `HEAD` differs from its recorded `evaluated_head` (someone committed since the evaluation), run step 10 first; otherwise step 12 for the next stage |
   | `DONE` | say so and stop |

## Plan

4. **Work type, flow and branch name.** Propose the work type from the Jira issue type (`harness-core` → Work types), and, following `git-workflow` flow selection, the flow, branch name (`bugfix` or `feature`), source branch and PR targets per stage. **Wait for the human to confirm**, then record **Work type, flow and branch confirmed**. Hotfix, OSOS and dormant-line tickets: escalate.
5. **Fetch.** `git -C <repo> fetch origin` for every workspace repo, so planning reads `origin/<source_branch>`. Do not change any checkout. Then rebuild the codebase map (`brain` → Codebase map).
6. **Planner.** Dispatch `engineering-harness:planner` with the ticket, Jira context, `work_type`, repo list, `source_branch`, the codebase map path (`sis-brain/codebase/`) when it exists, the local attachment paths (and any that could not be read, with the reason), the locked decisions, and — when resuming — the previous plan and the confirmed answers, or the track the human chose. Record **Plan written**.
   - `NEEDS_INPUT`: write the input packet for the questions QA or the SME can answer (`input-packets`), present every open question (developer-only ones in the terminal) and the packet path, and stop.
   - Invoked with `plan`: present the plan summary — root cause or scope, repos, proposed track — and stop.
7. **Confirm repos and track.** Show the plan's repo table (change vs context), the cross-repo contracts, and the proposed track with its reason against `harness-core` → Tracks. **Wait for the human to confirm both**, then record **Repos and track confirmed**. If the human moves a light proposal to full, re-run step 6 for the full plan before continuing.

## Implement and evaluate

8. **Create ticket branches.** For each repo to change:
   - Check `git -C <repo> status --porcelain`. If the repo has uncommitted changes, **do not overwrite, stash or discard them** — stop and ask.
   - If the ticket branch already exists locally or on origin, reuse it (`git -C <repo> switch <branch>`); otherwise `git -C <repo> switch -c <branch> origin/<source_branch>`.
   - Record **Branch created or reused**.
9. **Implementor.** Dispatch `engineering-harness:implementor` with the ticket, the plan, `decisions.md`, `state.json`, the codebase notes of each changed repo when they exist, and the current iteration (on a later iteration, only the evaluator's **blocking findings** as its scope). Record **Implementation reported**. If it stops because a light ticket outgrew the light criteria, propose moving to the full track; on the human's yes, record **Track changed** and go to step 6.
10. **Evaluator.** Dispatch `engineering-harness:evaluator` with the ticket, all artifacts, `decisions.md`, `state.json` and the current iteration. Record **Evaluation returned**.
11. **Branch on the verdict.**
    - `PASS` → step 12.
    - `FAIL` or `INSUFFICIENT_EVIDENCE` → for INSUFFICIENT_EVIDENCE, first try to obtain the missing evidence (e.g. run the unexecuted verification). Record **New iteration** with the reason. If `iteration` now exceeds `max_iterations` (2 on light, 3 on full), **stop**: write the escalation report from `templates/escalation-report.md` — on the light track it proposes moving to full — record **Escalated**, present it, and end. Otherwise go to step 9. Non-blocking recommendations never start an iteration.

The evaluation may never be bypassed, on either track.

## PRs

12. **Raise the PRs for the next open stage in `pr_targets`**, for every changed repo.
    - **Gate:** the latest verdict is `PASS` and every changed repo's `HEAD` equals its `evaluated_head`. Otherwise go back to step 10. Never skip this gate.
    - **A later stage** (stage 2 onwards) needs the human to confirm the previous stage is done **in every changed repo** — its PRs merged and verified, per `git-workflow`. `/work` stops after each stage because days can pass between them; re-running it raises the next.
    - **Check each changed repo:** the current branch is `branch`, the working tree is clean, and the committed change is scoped to the ticket (`git -C <repo> log origin/<source_branch>..HEAD`, `git -C <repo> diff origin/<source_branch>...HEAD`). If `flow`, `pr_targets` or `repos` is missing, stop and ask.
    - **Compose each PR** with: Jira, Summary, Implementation (this repo), Tests (executed in this repo), Verification (actual evidence), Evaluator (PASS), Iterations, **Related PRs** (the same ticket's PRs in the other repos, with any merge or deploy ordering from the plan), and Notes listing the **next human steps** for the flow per `git-workflow`.
    - **Raise one PR per changed repo × target in this stage only** — from the ticket branch, or from that target's resolve branch if it conflicts (`git-workflow` → Merge conflicts) — limited to the PRs `git-workflow` lets agents raise. Use `gh pr create --repo <owner>/<repo> --base <target> --head <branch>` **only if `gh auth status` succeeds**. Otherwise, per repo × target: push the head branch (`git -C <repo> push -u origin <head-branch>`, never force); derive `<owner>/<repo>` from `git -C <repo> remote get-url origin`; give a compare link with the title prefilled (`https://github.com/<owner>/<repo>/compare/<target>...<head-branch>?expand=1&title=<url-encoded title>`); write the description to `pr-<repo>-<target>.md` in the ticket folder. Present the links as one table (repo, target, head branch, link) and ask the human to reply with the PR URLs once created.
    - Record **PRs prepared**. **Never merge, approve, bypass checks or force-push.**
13. **Publish to Jira** if the configured Jira MCP supports it: the concise final summary (plan, implementation and evaluation status, track, repos, iterations, PR references). Never intermediate agent messages or chain-of-thought. If the MCP does not support writes (or a guard blocks them), say so and leave the record in the brain.
14. **Close the run.** Record **Run stops**, with `next_action` saying what the human does next.

At the end, present to the user: the track, the verdict, the iteration count, per-repo PR references (or compare links and descriptions), and remaining limitations.
