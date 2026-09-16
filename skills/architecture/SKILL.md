---
name: architecture
description: Guidance for reasoning about service boundaries, layering, coupling, transactions, API contracts, and backward compatibility when analyzing or designing changes in an enterprise system. Use when assessing how a change fits the existing architecture.
---

# Architecture

Use this skill when analyzing impact or designing changes.

## Reason about

- Service boundaries and domain responsibilities
- Dependencies and layering; coupling between modules
- API contracts and their consumers
- Transaction boundaries; synchronous vs asynchronous interactions
- Persistence boundaries and configuration
- Security boundaries, scalability, resilience
- Backward compatibility, observability, maintainability

## Principle

Favor **appropriate simplicity**. This harness changes an existing product, for bugs and features alike:

- Prefer the **smallest safe architectural change**; a feature extends the existing services, entities and components before it adds new ones.
- Do not introduce architectural changes merely because they are technically interesting.
- Do not invent new patterns when the existing codebase already has an established one — follow existing conventions.
- For a bug fix, changing architecture is almost always out of scope; document it as a recommendation instead.
- For a feature, a new service boundary, new async flow or new shared table is a design decision that needs its own decision record with the alternatives rejected — and usually a human conversation first.
