# Lesson template

Lessons live in the runtime repo's `lessons/` folder, one file per lesson, with a matching line in `lessons/index.jsonl` (see the `brain` skill → **Lesson recorded**, and the `lessons` skill for what is worth recording).

```markdown
# <id> — <one-line statement of what the next ticket should know>
- **Kind:** product | harness
- **From:** <TICKET-ID> · <packet answer | review comment | QA defect | evaluator finding> · <UTC date>
- **Stage that got it wrong:** plan | implement | evaluate | pr
- **Applies to:** <repos, comma-separated, or "all"> · area <product area, or "none">
- **Status:** proposed | confirmed <UTC timestamp> | retired — <what disproved it, or the harness PR that fixed it>

**What the run believed.** <the assumption, in one or two sentences>

**What is actually true.** <the correction, in the words of whoever gave it>

**Evidence.** <repo>/<path>:<line>, the Jira comment, or the failing check
```

## Rules

- **One lesson per record.** "And also" means two records.
- **Only a `confirmed` lesson is read by a later run.** A new record starts `proposed`.
- **Kind decides who acts.** `product` is read by future runs; `harness` is never read by a run, and waits for a maintainer to harvest it into a pull request against the plugin.
- **Evidence is required.** A file and line, a quoted Jira comment, or a command and its output. No file dumps, no reasoning transcript, no personal data.
- **Write it for someone with none of this context.** Not "the fix was wrong" — say what was believed and what is true.
- A lesson a later ticket disproves is set to `retired` with the reason. Never delete one; the trail is the point.
- The `index.jsonl` line carries what retrieval needs, so a run can pick the few lessons that matter without opening any file:

```json
{"id":"GSIS-28779-1","ts":"2026-09-22T10:40:00Z","ticket":"GSIS-28779","kind":"product","stage":"plan","repos":["sis-product-sis-admin-backend"],"area":"finance","source":"review","status":"confirmed","summary":"Manage Invoices shows an effective status; a sponsor-cancelled invoice still carries paidStatus PENDING"}
```

## Worked example

```markdown
# GSIS-28779-1 — The Manage Invoices grid shows an effective status, not the stored one
- **Kind:** product
- **From:** GSIS-28779 · review comment · 2026-09-22
- **Stage that got it wrong:** plan
- **Applies to:** sis-product-sis-admin-backend, sis-product-sis-frontend · area finance
- **Status:** confirmed 2026-09-22T11:05:00Z

**What the run believed.** An invoice's status on the Manage Invoices screen is `invoice.paidStatus`, so filtering on that column matches what the user sees.

**What is actually true.** The grid overrides the displayed status to CANCELLED whenever `sponsorInvoiceStatus` is CANCELLED, and cancelling a sponsor invoice never updates `paidStatus` — it stays PENDING from creation. Any filter, export or count on this screen has to match the effective status, not the stored one.

**Evidence.** `sis-product-sis-admin-backend/src/main/java/.../InvoiceSpecification.java:150`; cancellation path `cancelDraftedSponsorInvoice` leaves `paidStatus` untouched.
```
