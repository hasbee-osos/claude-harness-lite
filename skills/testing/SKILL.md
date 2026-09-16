---
name: testing
description: Risk-based testing guidance - behavior over implementation details, meaningful regression coverage, choosing the right test level (unit/integration/API/DB/frontend/E2E) for the actual risk. Use when planning or writing tests.
---

# Testing

Use this skill when defining or executing verification.

## Goal

**Appropriate confidence for the change** — not maximum test count.

## Principles

- Test behavior, not implementation details.
- Prefer meaningful regression coverage over coverage numbers. Never generate tests merely for coverage metrics.
- Avoid brittle tests (asserting internals, exact mock call sequences, unrelated formatting).
- Choose level by risk:
  - Pure service logic → unit test + existing related tests + build
  - Cross-layer bug → unit + integration + build
  - Repository/SQL/transaction/entity → integration test against an isolated real PostgreSQL instance where practical
  - Angular UI → frontend tests + targeted manual verification
  - API contract change → verify the API/integration boundary
- **Prove the ticket.** A bug needs a regression test that fails without the fix. A feature needs at least one test per acceptance criterion (`AC-n`), at the lowest level that really proves it; a criterion only a person can verify gets exact manual steps and a recorded result.
- Run existing tests related to the affected area before and after the change.
- Avoid: testing mocks instead of behavior, snapshot tests of generated noise, duplicating what an integration test already proves.

## Evidence

Every verification claim must be backed by an actually executed command and its real result. "Tests should pass" is not evidence.
