---
name: harness-core
description: The engineering harness's operating rules, read by every command and agent before acting - ground rules (Jira as source of truth, independent evaluator, locked decisions, human authority, evidence, bounded iteration, confirmed repos only), the multi-repo workspace and git -C usage, and what each stage produces for a bug versus a feature, including when a story is too big for one run.
---

# Harness core

This is an enterprise **engineering harness for an existing product**. It delivers Jira **bugs and features** (stories, tasks, improvements) through one pipeline, and each stage adapts to the work type (below). It is not a greenfield builder. Work starts from a Jira ticket and ends at PRs that a human reviews and merges. It runs in a **workspace** folder holding clones of all product repos; one ticket may change several of them.

## Ground rules

- **Jira is the source of work context.** Never fabricate ticket content. If Jira is unavailable, stop and ask. Attachments are part of that context: screen recordings and screenshots are read on every ticket that has them (`jira-attachments`), and one that could not be read is recorded as a gap, never silently skipped. They stay on the local machine.
- **Four agents** divide the work: Analyzer → Designer → Implementor → Evaluator. Keep their responsibilities separate. The Evaluator is independent and must never be skipped.
- **The brain is the durable record.** The orchestrating command writes each run's state, journal, decisions and artifacts to the ticket folder `<workspace>/sis-brain/tickets/<TICKET-ID>/`, as specified only in `brain`. Agents return their artifact to the orchestrator; they do not write the brain. Never put chain-of-thought, secrets or bulk file dumps there, and never commit the brain into a product repo.
- **Decisions are locked and citable.** Work type and flow, repos, root cause (bug) or scope and acceptance criteria (feature), fix or design approach, test strategy, convention deviations and the evaluator verdict each become a numbered record (`D-1`, `D-2`, …) in the ticket's `decisions.md`. Later stages cite the ID (`per D-3`). Changing course takes a new record that supersedes the old one. **Contradicting a locked decision without superseding it is a blocking evaluator finding.**
- **Humans retain final authority.** Never auto-merge, bypass checks, force-push, modify protected branches, approve your own PR or hide evaluator failures.
- **Touch only confirmed repos.** The human confirms which repos a ticket changes; every other repo is read-only context.
- **Evidence-based verification.** Never claim tests passed unless they were executed; record the command and the real result. Compilation is not verification, and passing tests are not "safe".
- **Bounded iteration.** The Implementor/Evaluator loop runs at most 3 iterations, and only blocking findings start another one. After that, stop and escalate to the human.
- **Team conventions outrank generic best practice** (`engineering-standards`). Make the smallest change that completely and safely delivers the ticket. Document unrelated problems as findings; do not fix them.

## Skills

| Skill | Covers | Read by |
|---|---|---|
| `harness-core` | these rules, the workspace, work types | every command and agent |
| `engineering-standards` | team conventions per stack, change principles, testing | Designer, Implementor, Evaluator; the Analyzer when a convention bears on the problem |
| `brain` | everything written to `sis-brain` | orchestrating commands only |
| `git-workflow` | flows, branch names, PR targets, protected branches, commits | orchestrating commands, Implementor |
| `jira-attachments` | downloading attachments, frames from recordings | orchestrating commands |
| `input-packets` | QA / SME questions as a paste-ready Jira comment | orchestrating commands |

## Workspace

The workspace is a plain parent folder (never a git repo) holding clones of the product repos (the Spring Boot services and the Angular UI) and the brain repo `sis-brain`. Claude is started there.

- **Product repos** are the immediate subfolders that contain `.git`. Skip any folder containing `.claude-plugin/` (a maintainer's clone of this plugin) or `.harness-brain` (the brain). If the session directory is itself a git repo, it is the only repo (single-repo mode).
- Refer to repos by folder name and cite code as `<repo>/<path>`.
- **Run git as `git -C <repo> …`**, one command per repo, with a literal path. Never rely on `cd`, and never put a variable or subshell in the path: `git-guard` denies git writes whose repo it cannot determine.
- **The code of record is `origin/<source_branch>`**, not the current checkout. If a file you rely on differs (`git -C <repo> diff --quiet HEAD origin/<source_branch> -- <path>` fails), read it with `git -C <repo> show origin/<source_branch>:<path>`.
- **Which repos change:** the Analyzer traces the flow (UI component → HTTP call → controller → service → repository/SQL, and service-to-service calls) and marks each repo **change** or **context** with evidence. The Designer confirms the list and names the cross-repo contracts. The human confirms before any branch is created; every changed repo then gets the same ticket branch name. `state.json` `repos` is that confirmed list.

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
| **Analyze** | What happens vs what should; **root cause** with evidence; alternatives ruled out | What exists today vs what the story asks; **gap** per screen / API / data; **acceptance criteria** (`AC-1…`); unclear business rules |
| **Locked after analysis** | Root cause, as one falsifiable sentence | Scope: ACs in, explicitly out, assumptions |
| **Design** | Smallest safe fix; regression surface | Smallest **complete** design meeting every AC: contracts, data model and Liquibase, UI, permissions, notifications/config, rollout order across repos; regression surface |
| **Locked after design** | Fix approach; test strategy | Design approach with alternatives rejected; test strategy; each new contract or schema choice worth defending |
| **Tests** | A regression test that fails before the fix and passes after | At least one test per AC at the right level |
| **Evaluate** | Is the bug fixed, with evidence and no regression? | Is **every AC met and evidenced**, with no regression and nothing beyond scope? |

The shared principle: **the smallest change that completely and safely delivers the ticket** — a narrow fix for a bug; for a feature, everything its acceptance criteria need, following existing patterns and common components, and nothing they don't.

### Acceptance criteria (feature)

- Take them from the ticket when written. When missing or vague, derive a draft and mark it **draft**; a draft is confirmed by the SME before design, never assumed.
- Number them `AC-1…` in the analysis. Design, tests, implementation report and evaluation cite the numbers, so each criterion traces from the ticket to a test with a real result.
- An AC that cannot be tested automatically names its manual verification step, which still needs recorded evidence.

### Story too big for one run (feature)

The Analyzer flags a story as too big when it has more than about 8 ACs; new behaviour across more than 2 repos each needing a new contract; a new domain entity **and** a new workflow or approval flow; or a change that could not reasonably be reviewed as one PR per repo. It then proposes **slices** (each independently deliverable and testable, with its ACs, repos and order) and returns `NEEDS_INPUT`. The human either creates the slices in Jira and runs `/work` on each, or tells the harness to build the whole story, which is recorded as a decision with its reason. The harness does not design an over-sized story without one of those answers.
