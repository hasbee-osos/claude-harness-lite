---
name: postgresql
description: PostgreSQL knowledge - SQL, schema, indexes, constraints, transactions, isolation, migrations, locking, and data integrity. Database changes are potentially high-risk. Use when a change touches SQL, schema, or persistence behavior.
---

# PostgreSQL

Use this skill when the change touches SQL, schema, migrations, or database behavior.

## Treat database changes as potentially high-risk

- Schema changes and migrations: forward compatibility, rollback story, locking implications (`ALTER TABLE` locks), downtime risk
- Indexes: existence, selectivity, unused/duplicated indexes
- Constraints: NOT NULL, FK, CHECK, unique — changing them changes data guarantees
- Transactions and isolation levels: read phenomena, deadlocks, serialization failures
- Locking: row vs table locks, long transactions, `FOR UPDATE` usage
- Data integrity: backfill strategy, NULL semantics, default values on existing rows
- Query behavior: plans, joins, pagination correctness, PostgreSQL-specific semantics (e.g. `NULLS DISTINCT` in unique constraints, type coercion, string comparison)

## Rules

- Verify behavior against an **isolated real PostgreSQL instance** where practical; do not rely exclusively on mocks when database behavior is material.
- Never run destructive SQL against shared or production-like environments.
- Migrations must be additive/compatible where possible; document required coordination (deploy order, backfills).
