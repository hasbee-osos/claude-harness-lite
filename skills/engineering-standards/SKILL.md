---
name: engineering-standards
description: How to change this product's code - the team's own conventions for Spring Boot, Angular and PostgreSQL/Liquibase (base classes, authorization, Liquibase scripts, usage checks, common components, error handling, GMT+0 dates), the smallest-safe-change principle, and risk-based testing including characterization tests. Read before designing, implementing or evaluating a change.
---

# Engineering standards

The team's written conventions **outrank generic best practice**. A change that ignores one is wrong even if it compiles and its tests pass. Deviating from a convention needs a decision record with the reason; an unjustified breach is a **blocking** Evaluator finding.

## Conventions for the stack you touch

Read the reference for each part of the stack the change touches, before designing, implementing or reviewing it. They are the team's guidelines, maintained in this repo (`docs/maintaining-guidelines.md`).

| The change touches | Read |
|---|---|
| Java / Spring Boot code | [`references/backend.md`](references/backend.md) — base classes, injection, authorization, deletion and usage checks, error handling, logging, notifications, business config; and [`references/java-code-review.md`](references/java-code-review.md) — general Java review criteria (project rules win where they differ) |
| Angular UI | [`references/frontend.md`](references/frontend.md) — common components, tables, dialogs, bulk save/delete, toggles |
| Schema, SQL, Liquibase, config-service changelogs | [`references/database.md`](references/database.md) — table naming and mandatory columns, script folders and numbering, FK guards, column types |

These apply to every change:

- **Dates and times** are stored in **GMT+0**; convert on the device for display and to the campus time zone for emails. Backend `DateUtils.convertTimeBasedCampusTimeZone()`, frontend `DateTimeUtils.convertTimeBasedDeviceTimeZone()`. Date-range filters use `DateUtils.getStartOfDay(date)` / `DateUtils.getEndOfDay(date)` (`>= fromDate`, `<= toDate`).
- **Code hygiene:** no commented-out code in frontend or backend, no `console.log` in frontend code, no unwanted whitespace.
- Review your own PR as soon as it is created and push fixes before someone else reviews it.

## Changing the code

- **Smallest change that completely and safely delivers the ticket:** a narrow fix for a bug; for a feature, everything its acceptance criteria need and nothing they don't. No speculative options, no unrelated refactoring, reformatting or drive-by fixes; record what you notice as findings.
- **Extend before adding.** Follow the existing services, entities, components and patterns. A new service boundary, async flow or shared table is a design decision that needs its own decision record with the alternatives rejected, and usually a human conversation first. For a bug, an architectural change is out of scope; record it as a recommendation.
- **Backward compatibility:** preserve existing REST contracts, DB semantics and behaviour unless the ticket requires the change. When a backend contract changes, check the affected UI flows: loading, success, error and empty states.
- **Database changes are high-risk:** consider locking, NULL semantics and defaults on existing rows, constraint changes and backfills. Keep migrations additive where possible and state any deploy order between repos. Never run destructive SQL against a shared or production-like environment.
- **Security:** never expose, log, commit or hardcode secrets; never weaken authentication, authorization or checks to make tests pass.
- No new dependencies unless demonstrably required. Comments only where genuinely useful.

## Testing

The goal is **appropriate confidence for the change**, not a test count.

| Change | Verification |
|---|---|
| Pure service logic | unit test + existing related tests + build |
| Cross-layer | unit + integration + build |
| Repository / SQL / transaction / entity mapping | integration test against an isolated real PostgreSQL where practical — not mocks alone when DB behaviour is material |
| Angular UI | component/service tests + targeted manual check of the affected screens |
| API contract | a test at the API boundary |

- **Prove the ticket.** A bug needs a regression test that fails without the fix. A feature needs at least one test per acceptance criterion (`AC-n`) at the lowest level that really proves it; a criterion only a person can verify gets exact manual steps and a recorded result.
- **Characterization first in low-coverage code:** before changing behaviour, pin the existing behaviour the ticket must preserve with a few focused tests, named so they read as pinning current behaviour. If one fails after your change, decide deliberately whether you broke preserved behaviour or the ticket changes it, and say which. Do not retrofit the whole area with tests.
- Test behaviour, not implementation details; no brittle assertions on internals or mock call sequences; no tests written for coverage numbers.
- Run the existing tests for the affected area before and after the change.
- Every verification claim names the command that was actually run and its real result.
