# Plan

Ticket: <ticket-id>
Work type: bug | feature  <!-- per harness-core → Work types; delete the sections marked for the other type -->
Track: light | full — <reason against harness-core → Tracks>  <!-- proposed here; the human confirms it with the repos -->

# Part 1 — Understanding

## Problem

<bug: one-two sentences on what is wrong. feature: one-two sentences on what the story asks for and for whom.>

## Expected / Observed

<bug: expected vs actual behavior. feature: the behavior wanted after delivery vs how the product behaves today in this area.>

## Acceptance Criteria (feature)

| ID | Criterion | Source |
|---|---|---|
| AC-1 | <testable statement> | ticket \| draft — confirm with SME |

## Attachments

| Attachment | Read | What it shows |
|---|---|---|
| <filename> | frames \| image \| document \| not read: <reason> | <`@ mm:ss` observations: screen, action, result, environment in the address bar — roles, never personal data> |

<"None." if the ticket has no attachments. Note any mismatch between a recording and the written steps.>

## Repositories

| Repo | Role | Why (evidence) |
|---|---|---|
| <repo-folder> | change \| context | <e.g. component calls `/api/x`; defect in `XService`; new endpoint needed beside `XController`> |

Flow: <e.g. frontend `x.component.ts` → `GET /api/x` → admin-backend `XController` → `XService` → `x_table`>

## Root Cause (bug)

<the root cause and mechanism as one falsifiable sentence, then the evidence and the alternatives ruled out>

## Gap (feature)

| Area | Today | Needed | AC |
|---|---|---|---|
| <screen / API / table / notification / permission> | <what exists> | <what must be added or changed> | AC-n |

Scope: <in scope; explicitly out of scope; assumptions>

Size: <fits one run | too big — proposed slices below, per harness-core → Work types>

<Proposed slices, only if too big: slice, its ACs, repos, order.>

## Open Questions

<questions, each marked for QA, SME or developer; or "None.">

<When stopping after Part 1: end here with `Status: NEEDS_INPUT`.>

# Part 2 — Plan

## Decisions

- **Following:** <locked decision IDs this plan builds on, e.g. D-1 (flow)>
- **New:** <one line per decision this plan locks — root cause or scope, fix or design approach with alternatives rejected, test strategy, contract or schema choices, any convention deviation — each written in full into `decisions.md` using `templates/decision-record.md`>
- **Superseding:** <locked decision this plan overturns, with the reason; or "None.">

## Conventions That Apply

- <team conventions this change must follow — base classes, `@PreAuthorizeGrant`, Liquibase script, common components, error handling, date handling — with the reference they come from>

## Change

### <repo-folder>

Files / modules:
- <classes, components, config, DB objects, APIs>

Steps:
1. <step>

<light: a few lines per repo.>

## Cross-Repo Contracts

- <endpoint / DTO field / error code / shared DB object both sides must agree on, or "None — single repo.">
- Ordering: <e.g. backend must reach base-qa together with or before the UI; or "None.">

## Acceptance Criteria Coverage (feature)

| AC | Delivered by (repo → change) | Proven by (test or manual step) |
|---|---|---|
| AC-1 | <repo → class/component/migration> | <test name and level, or exact manual step> |

## Regression Surface

<light: a short list of the behaviour to preserve and the likeliest regression.>

<full:>
- Direct: <what is being changed>
- Indirect: <what else could be affected>
- Dependent: <callers, consumers, APIs, DB and UI flows relying on the behavior, including other repos>
- Preserve: <unchanged behavior>
- Likely regressions: <most likely breakage scenarios>
- High-risk paths: <paths needing stronger verification>

## Tests

### <repo-folder>
- <risk-based verification: the test that proves the ticket, which levels and suites, which command, and why>

### Cross-repo (full)
- <how the contract is verified; or "Not needed.">

## Risk

<Low | Medium | High — one-line justification>

## Codebase map corrections

<omit this section unless the map was wrong, missing or stale for this ticket. One line each: `<repo>` — what the map says or lacks → what the code shows (`<repo>/<path>`)>.

## Status

READY_FOR_IMPLEMENTATION | NEEDS_INPUT
