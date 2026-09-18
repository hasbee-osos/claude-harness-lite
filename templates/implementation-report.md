# Implementation Report

Ticket: <ticket-id>
Iteration: <n>
Final fix round: <yes — no evaluation follows; the human reviewer checks it | no>
Branch: <ticket branch, same in every changed repo>

## <repo-folder>

### Changes

- <file/symbol: what changed and why>

### Tests

- <new/modified tests and what they pin: regression test (bug) or one test per AC-n (feature), plus characterization tests>

| Touch point (method / class / component) | Unit test (updated or created) |
|---|---|
| <`Class#method` or component> | <`TestClass#test` — updated / created> |

<Any touch point without a unit test: name it and the reason (no behaviour change, or cannot be unit-tested).>

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

## Blocking findings addressed (final fix round only)

<omit unless this is the final fix round. One row per blocking finding from the last evaluation.>

| Finding | Status | Fix | Executed test that covers it |
|---|---|---|---|
| <E-n> | closed / open | <file/symbol> | <command and real result> |

## Codebase map corrections

<omit this section unless you verified something the repo's codebase notes get wrong or lack, such as a build or test command, a time it takes, or an environment pitfall. One line each, with the command and the real result.>

## Status

COMPLETE | BLOCKED
