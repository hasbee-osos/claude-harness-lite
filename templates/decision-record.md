# Decision record template

Decisions live in `sis-brain/tickets/<TICKET-ID>/decisions.md`, appended in order, with sequential IDs. One `###` block per decision, exactly these bullets, in this order.

```markdown
### D-<n> — <one-line statement of what was decided>
- **Stage:** analyze | design | implement | evaluate | pr, iteration <n>
- **Decided by:** <agent or harness> · confirmed by human <UTC timestamp, or "not required">
- **Options considered:** <the realistic alternatives, separated by semicolons>
- **Why:** <the reason this option won — consequences, not restated intent>
- **Convention cited:** <file → rule, or "none">
- **Evidence:** <repo>/<path>:<line>, test output, Jira reference
- **Status:** LOCKED | SUPERSEDED by D-<n>
```

## Rules

- **One decision per record.** If you are writing "and also", it is two records.
- **State the decision, not the discussion.** No reasoning transcript; the conclusion and the reason it holds.
- **Options considered must be real** — alternatives that were genuinely on the table. Writing "do nothing" as a filler option makes the record useless.
- **Evidence is required** for anything about the code: a file and line, a command and its output, or a Jira reference. "Seems cleaner" is not evidence.
- A record is **LOCKED** the moment it is written. Later stages cite it (`per D-3`) and follow it.
- To reverse a decision: append a new record explaining why, then set the old one's Status to `SUPERSEDED by D-<n>`. Never rewrite a locked record's substance; a typo fix is fine.
- **Contradicting a locked decision without superseding it is a blocking evaluator finding.**

## Worked example

```markdown
### D-4 — Add a characterization test for the existing export before changing the filter
- **Stage:** design, iteration 1
- **Decided by:** designer · confirmed by human 2026-09-16T10:44Z
- **Options considered:** rely on the existing unit tests; add a characterization test over the current CSV output; manual QA only
- **Why:** the existing tests assert on mocks and would still pass if the export changed shape, so they cannot protect the regression surface named in the analysis
- **Convention cited:** `characterization-testing` skill → capture current behaviour before changing shared output
- **Evidence:** `sis-product-sis-admin-backend/src/test/java/.../ExportServiceTest.java:38` asserts only on the mocked repository call
- **Status:** LOCKED
```
