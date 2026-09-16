---
name: springboot
description: Practical Spring Boot enterprise knowledge - controllers, services, repositories, transactions, validation, Spring Data/JPA, configuration, exception handling, and integration testing. Use when working with Spring Boot code.
---

# Spring Boot

Use this skill when the change touches Spring Boot backend code.

**Read before changing or reviewing Java code:**
- [`references/java-code-review-guidelines.md`](references/java-code-review-guidelines.md) — the team's Java review criteria: structure and readability, business logic placement, maintainability, error handling and logging, security, performance.
- `engineering-standards`, whose [`references/sis-development-guidelines.md`](../engineering-standards/references/sis-development-guidelines.md) carries the **project-specific** rules that override generic Java advice: base entity/service/DTO classes, constructor injection, `@PreAuthorizeGrant`, Liquibase, `preDelete`/usage checks, `GearsException` error handling, `DateUtils`, `@Slf4j`.

## Understand before changing

- Controllers → services → repositories layering; dependency injection style used in this codebase
- Configuration: profiles, properties, environment-specific behavior
- Transactions: `@Transactional` scope, propagation, where boundaries live
- Validation: where input validation happens (annotations, service-level, both)
- Exception handling: global handlers (`@ControllerAdvice`), error response contract
- Spring Data / JPA: entity mappings, repositories, fetch strategies, lazy loading pitfalls
- Messaging and scheduling where present
- Logging and observability conventions already in use

## Rules

- Follow the codebase's existing conventions, not generic textbook architecture.
- Preserve existing REST contract semantics unless the ticket explicitly changes them.
- When persistence behavior is material to the bug, prefer integration tests over mocks-only verification.
- Beware: lazy-loading outside transactions, transaction boundaries on private/internal calls, validation gaps between layers, configuration differences across profiles.
