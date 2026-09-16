---
name: engineering-standards
description: Standards for small focused changes, readability, backward compatibility, security, error handling, and avoiding unrelated refactoring. The default principle is the smallest change that completely and safely delivers the ticket. Use for all implementation work.
---

# Engineering Standards

Default principle: **make the smallest change that completely and safely delivers the ticket** — a narrow fix for a bug; for a feature, everything its acceptance criteria need and nothing they don't.

## Project conventions — read first

[`references/sis-development-guidelines.md`](references/sis-development-guidelines.md) **is** the team's development guidelines — maintained as Markdown in this repo and growing continuously (see `docs/maintaining-guidelines.md` to propose a change).

**Read it before designing, implementing or evaluating a change**, and follow it over any generic best practice. It covers database and Liquibase rules, base entity/service/DTO classes, authorization annotations, deletion and usage checks, common frontend components, translatable error handling, GMT+0 date handling, logging, notification templates, business config and code hygiene.

Deviating from a convention needs an explicit, recorded reason. Breaking one is a blocking finding for the Evaluator, even when the code works and the tests pass.

## Standards

- **Focused changes** scoped to the Jira ticket and, for a feature, to its confirmed acceptance criteria. No speculative options or configurability the criteria don't ask for. No unrelated refactoring, reformatting, or drive-by fixes — document discovered issues as findings/recommendations instead.
- **Readability & maintainability**: match existing code style; no cleverness; no new dependencies unless demonstrably required.
- **Backward compatibility**: preserve existing APIs, DB semantics, and behavior unless the ticket explicitly requires a change.
- **Security**: never expose, print, commit, or hardcode secrets/credentials; never bypass authentication or weaken security controls to make tests pass; never disable security checks without explicit human authorization.
- **Error handling**: preserve existing error-handling patterns and contracts; failures must be informative, not swallowed.
- **Logging & observability**: follow existing conventions; log at the right level; do not log sensitive data.
- **Test quality**: tests must assert meaningful behavior and survive refactoring (see the `testing` skill).
- **Documentation**: only where genuinely useful (e.g. a migration note); no AI-essay comments.
