# Evaluation

Ticket: <ticket-id>
Iteration: <n>

## Verdict

PASS | FAIL | INSUFFICIENT_EVIDENCE

| Repo | Result | Note |
|---|---|---|
| <repo-folder> | PASS \| FAIL \| INSUFFICIENT_EVIDENCE | <one line> |
| Cross-repo consistency | PASS \| FAIL \| N/A | <one line> |
| Project conventions | PASS \| FAIL | <guidelines checked; unjustified breaches are blocking> |
| Locked decisions | PASS \| FAIL | <decisions checked; an unsuperseded contradiction is blocking> |
| Ticket outcome | PASS \| FAIL \| INSUFFICIENT_EVIDENCE | <bug: fix proven by a regression test; feature: every AC met with evidence, no scope beyond it> |

## Blocking Findings

- <[repo] material problems that must be fixed; "None." if empty>

## Non-Blocking Findings

- <recommendations that do not trigger another iteration>

## Required Changes

- <actionable items for the next iteration; "None.">

## Recommended Changes

- <optional improvements>

## Decisions Checked

| ID | Decision | Followed? | Note |
|---|---|---|---|
| D-<n> | <one line> | YES \| SUPERSEDED by D-<n> \| **CONTRADICTED** | <where, with file reference> |

## Acceptance Criteria Checked (feature)

| AC | Met? | Evidence |
|---|---|---|
| AC-1 | YES \| NO \| NOT EVIDENCED | <test run / command output / manual step result> |

## Evidence

- <commands actually executed and their results; artifacts inspected; gaps in evidence>
