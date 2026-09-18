# Implementation Report

Ticket: <ticket-id>
Iteration: <n>
Branch: <ticket branch, same in every changed repo>

## <repo-folder>

### Changes

- <file/symbol: what changed and why>

### Tests

- <new/modified tests and what they pin: regression test (bug) or one test per AC-n (feature), plus characterization tests>

### Verification Evidence

For each executed layer:

```
Command: <exact command, run in <repo-folder>>
Result:  <actual result, e.g. BUILD SUCCESSFUL / 12 tests passed>
```

<If a layer was not executed, state why (e.g. environment unavailable). Never claim unexecuted tests passed.>

### Diff Summary

<`git -C <repo> diff --stat` summary and commits; confirm scope limited to ticket>

## <repo-folder>

…

## Acceptance Criteria (feature)

| AC | Implemented in | Test / manual step | Result |
|---|---|---|---|
| AC-1 | <repo/path> | <test name or steps> | <actual executed result> |

## Cross-Repo Consistency

<how the contracts from the plan match on both sides, with file references; or "Single repo.">

## Decisions

- **Followed:** <decision IDs this implementation follows, with where: D-3 → `<repo>/<path>:<line>`>
- **New:** <decisions locked during implementation — typically a convention deviation — each written in full into `decisions.md`>
- **Contradicted:** <"None." — or stop and report; an implementation must not contradict a LOCKED decision without superseding it>

## Deviations from Plan

<deviations with justification, or "None.">

## Findings

<unrelated issues discovered (not fixed), or "None.">

## Status

COMPLETE | BLOCKED
