# Implementation Report

Ticket: <ticket-id>
Iteration: <n>
Branch: <ticket branch, same in every changed repo>

## <repo-folder>

### Changes

- <file/symbol: what changed and why>

### Tests

- <new/modified tests and what they pin: regression test + characterization tests>

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

## Cross-Repo Consistency

<how the contracts from the design match on both sides, with file references; or "Single repo.">

## Deviations from Design

<deviations with justification, or "None.">

## Findings

<unrelated issues discovered (not fixed), or "None.">

## Status

COMPLETE | BLOCKED
