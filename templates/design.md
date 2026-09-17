# Technical Design

Ticket: <ticket-id>
Work type: bug | feature

## Repositories

| Repo | Role | Summary |
|---|---|---|
| <repo-folder> | change \| context | <what changes there, or why it is read> |

Corrections to the analysis's repo list: <or "None.">

## Conventions That Apply

- <project guidelines this change must follow: base classes, `@PreAuthorizeGrant`, Liquibase script, common components, error handling, date handling, … — with the rule's source>

## Decisions

- **Following:** <locked decision IDs this design is built on, e.g. D-1 (flow), D-2 (root cause or scope)>
- **New:** <one line per decision this design locks — fix or design approach, test strategy, contract or schema choices, any convention deviation — each written in full into `decisions.md` using `templates/decision-record.md`>
- **Superseding:** <locked decision this design overturns, with the reason; or "None.">
- **Assumptions:** <anything new this design settles without asking anyone, with its basis — each locked as a decision and listed in the PR; or "None.">

## Cross-Repo Contracts

- <endpoint / DTO field / error code / shared DB object that both sides must agree on, or "None — single repo.">
- Ordering: <e.g. backend must reach base-qa together with or before the UI; or "None.">

## Change

### <repo-folder>

Files / modules:
- <classes, components, config, DB objects, APIs>

Steps:
1. <step>
2. <step>

### <repo-folder>

…

## Acceptance Criteria Coverage (feature)

| AC | Delivered by (repo → change) | Proven by (test or manual step) |
|---|---|---|
| AC-1 | <repo → class/component/migration> | <test name and level, or exact manual step> |

## Regression Surface

Direct:
- <what is being changed>

Indirect:
- <what else could be affected>

Dependent:
- <callers/consumers/APIs/DB/UI flows relying on the behavior, including other repos>

Existing behavior to preserve:
- <unchanged behavior>

Regression scenarios:
- <most likely breakage scenarios>

High-risk paths:
- <paths needing stronger verification>

## Tests

### <repo-folder>
- <risk-based verification plan: which levels, which suites, which command, and why>

### Cross-repo
- <how the contract is verified, e.g. API test against the changed endpoint matching the UI's expectations; or "Not needed.">

## Risk

<Low|Medium|High — with one-line justification>

## Status

READY_FOR_IMPLEMENTATION | NEEDS_INPUT
