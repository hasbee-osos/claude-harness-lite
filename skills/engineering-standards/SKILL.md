---
name: engineering-standards
description: Standards for small focused changes, readability, backward compatibility, security, error handling, and avoiding unrelated refactoring. The default principle is the smallest change that safely solves the problem. Use for all implementation work.
---

# Engineering Standards

Default principle: **make the smallest change that safely solves the problem.**

## Standards

- **Small focused changes** scoped to the Jira ticket. No unrelated refactoring, reformatting, or drive-by fixes — document discovered issues as findings/recommendations instead.
- **Readability & maintainability**: match existing code style; no cleverness; no new dependencies unless demonstrably required.
- **Backward compatibility**: preserve existing APIs, DB semantics, and behavior unless the ticket explicitly requires a change.
- **Security**: never expose, print, commit, or hardcode secrets/credentials; never bypass authentication or weaken security controls to make tests pass; never disable security checks without explicit human authorization.
- **Error handling**: preserve existing error-handling patterns and contracts; failures must be informative, not swallowed.
- **Logging & observability**: follow existing conventions; log at the right level; do not log sensitive data.
- **Test quality**: tests must assert meaningful behavior and survive refactoring (see the `testing` skill).
- **Documentation**: only where genuinely useful (e.g. a migration note); no AI-essay comments.
