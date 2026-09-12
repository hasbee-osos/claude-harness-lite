---
name: characterization-testing
description: How to work safely in legacy codebases with poor test coverage - capture existing behavior before changing it, add focused regression tests, avoid test inflation. Use when implementing changes in low-coverage areas.
---

# Characterization Testing

Core principle: **before changing behavior, understand and capture the behavior that must remain unchanged.**

Use this skill in legacy/low-coverage areas. Do not attempt to retrofit the entire application with tests.

## Method

1. Identify the behavior affected by the ticket.
2. Trace the execution path through the existing code.
3. Identify important existing behavior that must be preserved.
4. Capture that behavior with focused tests where practical (pin current behavior, including quirks you must not change).
5. Implement the smallest safe change.
6. Add the regression test for the bug itself.
7. Verify surrounding behavior using the captured tests.
8. Stop. Do not inflate the test suite beyond the risk.

## Characterization targets

Service behavior, API responses, validation rules, database interactions, calculation logic, state transitions, event/message behavior.

## Rules

- Characterization tests document current behavior; mark clearly (naming/comments) that they pin existing behavior.
- If a characterization test fails after your change, either your change broke preserved behavior or the test captured behavior the ticket explicitly changes — decide deliberately and document which.
- Every bug fix should, where practical, leave the codebase with a stronger regression safety net than before.
