# Technical Design

Ticket: <ticket-id>

## Repositories

| Repo | Role | Summary |
|---|---|---|
| <repo-folder> | change \| context | <what changes there, or why it is read> |

Corrections to the analysis's repo list: <or "None.">

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
