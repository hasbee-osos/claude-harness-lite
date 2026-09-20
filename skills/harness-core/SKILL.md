---
name: harness-core
description: The engineering harness's operating rules, read by every command and agent before acting - ground rules (Jira as source of truth, independent evaluator, locked decisions, human authority, evidence, bounded iteration, confirmed repos only), the multi-repo workspace and git -C usage, what each stage produces for a bug versus a feature, the light and full tracks, and when a story is too big for one run.
---

# Harness core

This is an enterprise **engineering harness for an existing product**. It delivers Jira **bugs and features** (stories, tasks, improvements) through one pipeline, and each stage adapts to the work type and the track (below). It is not a greenfield builder. Work starts from a Jira ticket and ends at PRs that a human reviews and merges. It runs in a **workspace** folder holding clones of all product repos; one ticket may change several of them.

## Ground rules

- **Jira is the source of work context.** Never fabricate ticket content. If Jira is unavailable, stop and ask. Attachments are part of that context: screen recordings and screenshots are read on every ticket that has them (`jira-attachments`), and one that could not be read is recorded as a gap, never silently skipped. They stay on the local machine.
- **Three agents** divide the work: Planner → Implementor → Evaluator. The Planner understands the ticket and plans the change in one pass; the Evaluator is independent of both and must never be skipped, on either track: every ticket is evaluated at least once before any PR.
- **The brain is the durable record.** The orchestrating command writes each run's state, journal, decisions and artifacts to the ticket folder `<workspace>/sis-brain/tickets/<TICKET-ID>/`, as specified only in `brain`. Agents return their artifact to the orchestrator; they do not write the brain. Never put chain-of-thought, secrets or bulk file dumps there, and never commit the brain into a product repo.
- **Decisions are locked and citable.** Work type and flow, track, repos, root cause (bug) or scope and acceptance criteria (feature), fix or design approach, test strategy, convention deviations and the evaluator verdict each become a numbered record (`D-1`, `D-2`, …) in the ticket's `decisions.md`. Later stages cite the ID (`per D-3`). Changing course takes a new record that supersedes the old one. **Contradicting a locked decision without superseding it is a blocking evaluator finding.**
- **Humans retain final authority.** Never auto-merge, bypass checks, force-push, modify protected branches, approve your own PR or hide evaluator failures.
- **Touch only confirmed repos.** The human confirms which repos a ticket changes; every other repo is read-only context.
- **Evidence-based verification.** Never claim tests passed unless they were executed; record the command and the real result. Compilation is not verification, and passing tests are not "safe".
- **Bounded iteration, then human review.** The Evaluator runs at most once on the light track and twice on the full track, and only blocking findings start another round. When the last evaluation still has blocking findings, the Implementor makes one final fix round and the PR goes to the human reviewer, with those fixes listed as not re-evaluated. If the final round cannot close a finding, stop and escalate to the human.
- **Team conventions outrank generic best practice** (`engineering-standards`). Make the smallest change that completely and safely delivers the ticket. Document unrelated problems as findings; do not fix them.

## Skills

| Skill | Covers | Read by |
|---|---|---|
| `harness-core` | these rules, the workspace, work types, tracks | every command and agent |
| `engineering-standards` | team conventions per stack, change principles, testing | Planner, Implementor, Evaluator |
| `brain` | everything written to `sis-brain` | orchestrating commands only |
| `git-workflow` | source branch and PR target from the Jira Customer Name field, branch names, resolve branches, protected branches, commits | orchestrating commands, Implementor |
| `jira-attachments` | downloading attachments, frames from recordings | orchestrating commands |
| `input-packets` | QA / SME questions as a paste-ready Jira comment | orchestrating commands |

## Workspace

The workspace is a plain parent folder (never a git repo) holding clones of the product repos (the Spring Boot services and the Angular UI) and the brain repo `sis-brain`. Claude is started there.

- **Product repos** are the immediate subfolders that contain `.git`. Skip any folder containing `.claude-plugin/` (a maintainer's clone of this plugin) or `.harness-brain` (the brain). If the session directory is itself a git repo, it is the only repo (single-repo mode).
- Refer to repos by folder name and cite code as `<repo>/<path>`.
- **Run git as `git -C <repo> …`**, one command per repo, with a literal path. Never rely on `cd`, and never put a variable or subshell in the path: `git-guard` denies git writes whose repo it cannot determine.
- **The code of record is `origin/<source_branch>`**, not the current checkout. If a file you rely on differs (`git -C <repo> diff --quiet HEAD origin/<source_branch> -- <path>` fails), read it with `git -C <repo> show origin/<source_branch>:<path>`.
- **The codebase map** (`sis-brain/codebase/`) gets agents to the right files quickly: hand-written notes per repo (layout, where things live, build and test commands, pitfalls) and generated indexes (screens, routes, endpoints, tables). It is a hint, never evidence. Agents read and cite the code, and report where the map was wrong. `brain` → Codebase map specifies it.
- **Which repos change:** the Planner traces the flow (UI component → HTTP call → controller → service → repository/SQL, and service-to-service calls), marks each repo **change** or **context** with evidence, and names the cross-repo contracts. The human confirms before any branch is created; every changed repo then gets the same ticket branch name. `state.json` `repos` is that confirmed list.

## Work types

| Jira issue type | Work type | Branch type (`git-workflow`) | Questions go to |
|---|---|---|---|
| Bug | **bug** | `bugfix` | QA (`qa-packet.md`) |
| Story, Task, Improvement | **feature** | `feature` | SME (`sme-packet.md`) |
| Sub-task | the parent's | the parent's | the parent's |
| Epic, or anything else | not handled — ask the human for a story or bug under it | — | — |

The orchestrator proposes the work type with the flow and branch, and the human confirms it. If the content contradicts the issue type (a "Story" describing broken behaviour, a "Bug" asking for new behaviour), say so and let the human choose; never switch silently.

| Stage | bug | feature |
|---|---|---|
| **Plan — understanding** | What happens vs what should; **root cause** with evidence; alternatives ruled out | What exists today vs what the story asks; **gap** per screen / API / data; **acceptance criteria** (`AC-1…`); unclear business rules |
| **Plan — the change** | Smallest safe fix; regression surface | Smallest **complete** change meeting every AC: contracts, data model and Liquibase, UI, permissions, notifications/config, rollout order across repos; regression surface |
| **Locked from the plan** | Root cause (one falsifiable sentence); fix approach; test strategy | Scope (ACs in, explicitly out, assumptions); approach with alternatives rejected; test strategy; each new contract or schema choice worth defending |
| **Tests** | A regression test that fails before the fix and passes after | At least one test per AC at the right level |
| **Evaluate** | Is the bug fixed, with evidence and no regression? | Is **every AC met and evidenced**, with no regression and nothing beyond scope? |

The shared principle: **the smallest change that completely and safely delivers the ticket** — a narrow fix for a bug; for a feature, everything its acceptance criteria need, following existing patterns and common components, and nothing they don't.

### Acceptance criteria (feature)

- Take them from the ticket when written. When missing or vague, derive a draft and mark it **draft**; a draft is confirmed by the SME before the change is planned, never assumed.
- Number them `AC-1…` in the plan. The plan, tests, implementation report and evaluation cite the numbers, so each criterion traces from the ticket to a test with a real result.
- An AC that cannot be tested automatically names its manual verification step, which still needs recorded evidence.

### Story too big for one run (feature)

The Planner flags a story as too big when it has more than about 8 ACs; new behaviour across more than 2 repos each needing a new contract; a new domain entity **and** a new workflow or approval flow; or a change that could not reasonably be reviewed as one PR per repo. It then proposes **slices** (each independently deliverable and testable, with its ACs, repos and order) and stops after understanding with `NEEDS_INPUT`. The human either creates the slices in Jira and runs `/work` on each, or tells the harness to build the whole story, which is recorded as a decision with its reason. The harness does not plan an over-sized story without one of those answers.

## Tracks

Every ticket runs on one of two tracks, so the process costs what the ticket needs. The Planner proposes the track with its reason; the human confirms it together with the repos to change, and it is locked as a decision. **`/work <ticket> --lite` forces the light track:** the Planner plans at light depth and lists any light criterion below that the ticket does not meet as a risk, the track is not asked again, and the decision records that the developer forced it.

| | **light** | **full** |
|---|---|---|
| Plan | Understanding in full; the change, tests and AC coverage in a few lines | Every section in full, including cross-repo contracts and the complete regression surface |
| Flow | implement → evaluate → final fix → PR | implement → evaluate → implement → evaluate → final fix → PR |
| Evaluation rounds | 1 | 2 |
| After a PASS | PR straight away | PR straight away |
| Final fix round | the last evaluation's blocking findings only, not re-evaluated; the human reviewer checks them in the PR | same |

Unless the developer forces it with `--lite`, a ticket is **light** only when all of these hold; otherwise it is **full**:

- **bug:** the root cause is established with evidence. **feature:** at most 3 acceptance criteria, all confirmed (none draft).
- At most 2 repos change, and any change to a contract between them is additive (a new optional field or a new endpoint), never a changed or removed one.
- No new entity or table, no new workflow, approval flow or notification event.
- Nothing touching authentication, authorization (`@PreAuthorizeGrant`), deletion checks, or existing rows (backfills, data fixes).

If implementation shows a light ticket is bigger than planned, the Implementor stops and reports it; the harness proposes moving the ticket to full, and the human decides. On a ticket forced light with `--lite`, the Implementor reports it but carries on, because the developer already chose the light journey. Moving to full is a new decision that supersedes the track decision, and the Planner is re-run to write the full plan as the next revision.
