---
name: work-types
description: The harness handles bugs and features (stories, tasks, improvements) - how a ticket's work type is chosen from Jira, and what each stage produces for each type - analysis, locked decisions, design, tests, evaluation, packets - plus when a story is too big for one run and must be split. Read before any stage acts on a ticket.
---

# Work types

The harness delivers **bugs and features** from Jira through the same pipeline: analyze → design → implement → evaluate → PR. The stages, guards, brain and human gates are identical. **What each stage looks for and proves** depends on the work type.

## Choosing the work type

| Jira issue type | Work type | Branch type (`git-workflow`) |
|---|---|---|
| Bug | **bug** | `bugfix` |
| Story, Task, Improvement | **feature** | `feature` |
| Sub-task | the parent's work type | the parent's |
| Epic, or anything else | not handled; ask the human to pick a story or bug under it | — |

The orchestrator proposes the work type together with the flow and branch. Once the human confirms, the work type goes into `state.json` as `work_type: "bug" | "feature"` and into the flow decision record. If the ticket's content contradicts its issue type (a "Story" describing broken existing behaviour, a "Bug" asking for new behaviour), say so and let the human choose; never switch silently.

## What each stage does

| Stage | bug | feature |
|---|---|---|
| **Analyze** | What happens vs what should; **root cause** with evidence; alternatives ruled out | What exists today vs what the story asks; **gap** per screen / API / data; **acceptance criteria** as understood (`AC-1…`); unclear business rules |
| **Locked decision after analysis** | Root cause (one falsifiable sentence) | Scope: acceptance criteria in, explicitly out, and assumptions |
| **Design** | Smallest safe fix; regression surface | Smallest **complete** design meeting every AC: contracts (endpoints, DTOs, error codes), data model and Liquibase changes, UI changes, permissions, notification/config needs, rollout order across repos; regression surface on existing behaviour |
| **Locked decisions after design** | Fix approach; test strategy | Design approach (with alternatives rejected); test strategy; every new contract or schema choice worth defending later |
| **Tests** | A regression test that fails before the fix and passes after; characterization tests around it | At least one test per AC at the right level (`testing`); characterization tests on existing behaviour the feature touches |
| **Evaluate** | Is the bug fixed (evidence), with no regression? | Is **every AC met and evidenced**, with no regression, and nothing built beyond scope? |
| **Questions** (last resort, `input-packets`) | `qa-packet.md` | `sme-packet.md` |

The shared principle behind both is the same: **the smallest change that completely and safely delivers the ticket.** For a bug that is a narrow fix. For a feature it is everything the acceptance criteria need, following existing patterns and common components, and nothing they don't. Gold-plating, speculative configurability and "while we're here" refactors are out of scope for both.

## Acceptance criteria (feature)

- Take them from the ticket when they are written. When they are missing or vague, derive a draft from the description, the product's behaviour today and similar features, and mark it **draft** with its basis. The developer confirms drafts in the terminal before design; only a criterion with two reasonable readings that passes the bar in `input-packets` goes to the SME.
- Number them `AC-1…` in the analysis. The design, tests, implementation report and evaluation all cite those numbers, so every criterion can be traced from the ticket to a test with a real result.
- An AC that cannot be tested automatically names its manual verification step instead. It still needs evidence.

## Story too big for one run (feature)

After analysis, the Analyzer flags a story as **too big** when any of these hold:
- more than about 8 acceptance criteria;
- new behaviour across more than 2 repos, each needing a new contract;
- a new domain entity **and** a new workflow or approval flow;
- the change could not reasonably be reviewed as one PR per repo.

When it does:
1. It proposes **slices**: each one independently deliverable and testable, with its ACs, the repos it touches, and the order it has to follow.
2. The orchestrator shows them to the developer in the terminal. Slicing is a delivery decision, so it does not go to the SME.

The developer then either:
- creates the slices as Jira stories or sub-tasks and runs `/work` on each (the harness can't write to Jira), or
- tells the harness to proceed with the whole story. That override is recorded as a decision with its reason.

The harness does not design or implement an over-sized story without one of those two answers.
