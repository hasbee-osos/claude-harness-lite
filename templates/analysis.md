# Analysis

Ticket: <ticket-id>
Work type: bug | feature  <!-- per work-types; delete the sections marked for the other type -->

## Problem

<bug: one-two sentences on what is wrong. feature: one-two sentences on what the story asks for and for whom.>

## Expected

<bug: expected behavior. feature: the behavior wanted after delivery.>

## Observed

<bug: actual behavior. feature: how the product behaves today in this area.>

## Acceptance Criteria (feature)

| ID | Criterion | Source |
|---|---|---|
| AC-1 | <testable statement> | ticket \| draft — <basis>; developer confirms |

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

<likely root cause + mechanism as one falsifiable sentence, then the evidence and the alternatives ruled out>

## Gap (feature)

| Area | Today | Needed | AC |
|---|---|---|---|
| <screen / API / table / notification / permission> | <what exists> | <what must be added or changed> | AC-n |

Scope: <in scope; explicitly out of scope; assumptions>

Size: <fits one run | too big — proposed slices below, per work-types>

<Proposed slices, only if too big: slice, its ACs, repos, order.>

## Affected

- <modules/services/components>

## Regression Surface

- <existing behavior that must be preserved / what could break>

## Evidence

- <`<repo>/<path>`, symbols, tests that support the conclusions (as of `origin/<source_branch>`)>

## Assumptions

<What was settled without asking anyone. Each becomes a locked decision and is listed in the PR for QA to verify. "None." if none.>

| Assumption | Basis | If wrong |
|---|---|---|
| <what we will build or treat as true> | <existing behaviour, sibling feature, ticket wording, convention — with evidence> | <what would change> |

## Questions

<Only questions that pass the bar in input-packets: at most 3 for QA or the SME, one round for the whole ticket. "None." if none.>

| # | Question | Audience | Why it blocks | Looked in |
|---|---|---|---|---|
| 1 | <question> | qa \| sme \| developer | <different answers → different build> | <ticket, comments, GSIS-… found by JQL, code and history, tests> |

## Status

READY_FOR_DESIGN | NEEDS_INPUT
