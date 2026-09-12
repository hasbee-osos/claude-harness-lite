---
name: repository-analysis
description: Systematic method for understanding an unfamiliar codebase - structure, build system, entry points, modules, dependencies, API boundaries, business flows, persistence, tests, configuration. Search before guessing. Use when analyzing a codebase or locating a bug.
---

# Repository Analysis

Use this skill to systematically understand an unfamiliar codebase. **Search before guessing.** Identify the smallest relevant code path rather than reading the entire repository.

## Inspection order

1. **Repository structure** — top-level layout, modules/services, READMEs
2. **Build system** — Maven/Gradle/npm, build commands, module aggregation
3. **Application entry points** — main classes, bootstrap config
4. **Modules** — boundaries, what depends on what
5. **Dependency graph** — internal modules and key external libraries
6. **API boundaries** — REST controllers, clients, contracts
7. **Business flow** — trace the flow relevant to the ticket end-to-end
8. **Persistence** — entities, repositories, migrations, SQL
9. **Tests** — what exists, how it is run, coverage gaps
10. **Configuration** — profiles, properties, environment differences
11. **Observability** — logging, metrics, error handling patterns

## Locating a bug

- Start from the symptom: search for error messages, status codes, field names, and domain terms from the ticket.
- Trace the call path from the entry point (controller/UI) to the defect site.
- Read the surrounding tests to understand expected behavior.
- Note what behavior must be preserved (feed this to the regression surface).
