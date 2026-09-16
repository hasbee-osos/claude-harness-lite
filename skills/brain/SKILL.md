---
name: brain
description: The brain - the team's shared git repo, cloned into the workspace as sis-brain, holding the durable per-ticket record of every harness run (state, append-only journal, locked decisions with justification, versioned artifacts, metrics), how to sync it, how to resume a ticket in a new session, and what must never be written there. Read before any harness command or agent acts.
---

# The Brain

The **brain** is the team's shared record: a git repo cloned into the workspace as `sis-brain`, with one folder per ticket recording what the harness did, what it decided, and why. Every session pulls it, writes to it and pushes, so any session — days later, a different person, a different machine — can read it and pick up exactly where the last one stopped.

It replaces the old `.runtime/` folder. That folder was declared temporary scratch, so iteration history was overwritten and the reasoning behind a fix was lost when the session ended. **If a ticket is reopened, the brain is the answer to "why was it done this way?".**

## Layout

```text
<workspace>/sis-brain/            ← a clone of the team's brain repo
├── .harness-brain             ← marker; git-guard allows commits and pushes here
├── .gitignore                 ← metrics/ , current.json
├── .gitattributes             ← *.jsonl merge=union
├── README.md                  ← seeded on first run
├── index.jsonl                ← one line per ticket milestone (append-only, shared)
├── current.json               ← live pointer: which ticket/stage is running now — NOT committed
├── metrics/                   ← NOT committed; Prometheus reads these from disk
│   ├── runs.jsonl             ← one record per collection window (telemetry)
│   └── harness.prom           ← Prometheus textfile exposition
└── tickets/<TICKET-ID>/
    ├── state.json             ← the resume point
    ├── journal.jsonl          ← append-only event log
    ├── decisions.md           ← locked decisions with justification
    ├── analysis.md            ← a later revision is analysis-2.md, …
    ├── design.md
    ├── qa-packet.md | sme-packet.md  ← paste-ready Jira comment when a stage needs answers (input-packets)
    ├── implementation-report-1.md, -2.md, …
    ├── evaluation-1.md, -2.md, …
    ├── escalation-report.md
    ├── pr-<repo>-<target>.md
    └── metrics.json           ← per-ticket rollup
```

- **The brain is its own git repo**, shared by the team and cloned into the workspace as `sis-brain`. The workspace folder around it is a plain container and is never version-controlled.
- **Never inside a product repo.** The brain sits at the workspace root, beside the repo clones. If `sis-brain` is missing or is not a git repo, say so and ask the human to clone it — do not silently start a local-only brain.
- **Iteration artifacts are numbered, never overwritten.** `evaluation-1.md` survives iteration 2. `state.json` `artifacts` records the latest of each.
- **Keep the brain out of code searches.** The workspace needs a `.ignore` file at its root containing `sis-brain/`. ripgrep honours `.ignore`, so cross-repo code searches stop returning harness records as matches — analyses and decisions quote class names and file paths, and after a few dozen tickets they would drown the real code. `Grep` with an explicit path into the brain still works, so searching the record is unaffected. Create the file on first use if it is missing, or append the line if it exists without it. It sits in the workspace, which is not a git repo, so there is nothing to commit.
- On first use, seed anything missing at the repo root — `.harness-brain`, `README.md` (from `templates/brain-readme.md`), `.gitignore` (`metrics/`, `current.json`) and `.gitattributes` (`*.jsonl merge=union`) — and commit them.

## Syncing

The brain is shared, so every session keeps it current. All of this runs as `git -C <workspace>/sis-brain …`.

- **Pull before reading.** `git -C sis-brain pull --rebase` when a ticket starts or resumes, so you see what colleagues have recorded.
- **Commit and push at every milestone**, not only at the end: analysis written, design and repos confirmed, each branch created, each evaluation verdict, PRs prepared, ticket closed. A session that dies mid-ticket must leave nothing stranded on one machine.
- **Commit message:** `<TICKET-ID>: <milestone>` — e.g. `GSIS-12345: evaluation 2 - FAIL, 2 blocking`. One ticket per commit; never mix two tickets.
- **Rejected push?** `git -C sis-brain pull --rebase`, then push again. **Never force-push and never rewrite history** — git-guard blocks both here as everywhere else.
- **Conflicts are rare by design.** Each ticket owns its folder, so two people on two tickets never collide. `index.jsonl` is shared but append-only, and `merge=union` resolves it automatically. A genuine conflict means two sessions worked the same ticket: stop and ask the human which record is right.
- Everyone commits straight to `main`. The brain is a record, not code — there is no review gate, because a gate would stop it being current.
- `metrics/` and `current.json` are machine-local and gitignored. `tickets/<id>/metrics.json` **is** committed: it is what that ticket cost.

## What must never be written to the brain

This record is pushed to GitHub and read by the whole team, so the list is not advisory.

- **Chain-of-thought.** Record conclusions, decisions and evidence — not reasoning transcripts.
- **Secrets, credentials, tokens, connection strings** — in any artifact, journal line or PR description.
- **Bulk file dumps.** Cite `<repo>/<path>:<line>`; do not paste files.
- **Jira content beyond what the work needs** — the summary, the acceptance criteria that matter, and the ticket link. Not whole comment threads, not personal data.
- Anything a teammate opening the folder in six months should not be reading.

## `state.json`

```json
{
  "schema_version": 1,
  "ticket": "GSIS-12345",
  "status": "ANALYZING | DESIGNING | AWAITING_REPO_CONFIRMATION | IMPLEMENTING | EVALUATING | PR_STAGE_1 | PR_STAGE_2 | DONE | NEEDS_INPUT | ESCALATED",
  "next_action": "Re-run the implementor with the blocking findings E-1 and E-3 from evaluation-2.md",
  "blocked_on": null,
  "created_at": "2026-09-16T09:10:00Z",
  "updated_at": "2026-09-16T11:42:00Z",
  "iteration": 2,
  "max_iterations": 3,
  "workspace": "C:/sis-workspace",
  "flow": "A",
  "source_branch": "base-development",
  "branch": "base/bugfix/GSIS-12345-short-desc",
  "repos": {
    "sis-product-sis-admin-backend": { "role": "change", "branch_created": true },
    "sis-product-sis-frontend":      { "role": "change", "branch_created": true }
  },
  "context_repos": ["sis-product-sis-student-service"],
  "pr_targets": [
    { "stage": 1, "targets": ["base-sandbox-qa"], "status": "OPEN" },
    { "stage": 2, "targets": ["gcet-sandbox-qa", "gutech-sandbox-qa"], "status": "PENDING" }
  ],
  "prs": [
    {
      "repo": "sis-product-sis-frontend",
      "stage": 1,
      "target": "base-sandbox-qa",
      "head": "base/bugfix/GSIS-12345-short-desc",
      "resolve_branch": null,
      "compare_link": "https://github.com/pbsgears/sis-product-sis-frontend/compare/…",
      "url": null
    }
  ],
  "sessions": [
    { "session_id": "893ff923-…", "started_at": "2026-09-16T09:10:00Z", "ended_at": null }
  ],
  "human_confirmations": [
    { "what": "flow_and_branch", "at": "2026-09-16T09:18:00Z", "value": "Flow A, base/bugfix/GSIS-12345-short-desc, source base-development" },
    { "what": "repos_to_change", "at": "2026-09-16T10:31:00Z", "value": ["sis-product-sis-admin-backend", "sis-product-sis-frontend"] }
  ],
  "decisions": ["D-1", "D-2", "D-3"],
  "artifacts": {
    "analysis": "analysis.md",
    "qa_packet": "qa-packet.md",
    "design": "design.md",
    "implementation": "implementation-report-2.md",
    "evaluation": "evaluation-2.md"
  },
  "analysis": "READY | NEEDS_INPUT",
  "design": "READY | NEEDS_INPUT",
  "implementation": "COMPLETE | BLOCKED",
  "evaluation": "PASS | FAIL | INSUFFICIENT_EVIDENCE"
}
```

- `flow`, `source_branch`, `branch` and `pr_targets` follow `git-workflow` and are the same for every changed repo.
- A stage is done only when **every** changed repo has its PRs merged for that stage and the human confirms verification.
- **Write `next_action` in plain words every time `status` changes.** It is what a new session reads first.
- Update `updated_at` on every write.

## `journal.jsonl` — append-only

One JSON object per line. Never rewrite or delete a line; a mistake is corrected by appending, not by editing.

```json
{"ts":"2026-09-16T09:10:00Z","event":"ticket_started","ticket":"GSIS-12345","session_id":"893ff923-…"}
{"ts":"2026-09-16T10:02:11Z","event":"stage_start","stage":"design","iteration":1}
{"ts":"2026-09-16T10:31:02Z","event":"decision_locked","id":"D-3","summary":"Fix in the service layer, not the SQL view"}
{"ts":"2026-09-16T10:31:44Z","event":"human_confirmed","what":"repos_to_change","value":["sis-product-sis-admin-backend"]}
{"ts":"2026-09-16T11:05:18Z","event":"evaluation","verdict":"FAIL","blocking":2,"non_blocking":1,"iteration":1}
{"ts":"2026-09-16T11:40:57Z","event":"pr_prepared","repo":"sis-product-sis-frontend","target":"base-sandbox-qa","url":null}
```

Event vocabulary — a closed set. Do not invent events.

| Event | When | Required fields |
|---|---|---|
| `ticket_started` | first time the ticket is touched | `ticket`, `session_id` |
| `session_resumed` | a new session picks the ticket up | `session_id`, `from_status` |
| `stage_start` / `stage_end` | before and after each agent or command stage | `stage`, `iteration` |
| `iteration_start` | a new implement/evaluate cycle begins | `iteration`, `reason` |
| `human_confirmed` | the human approves something the harness paused for | `what`, `value` |
| `decision_locked` | a decision record is added | `id`, `summary` |
| `decision_superseded` | a locked decision is replaced | `id`, `superseded_by` |
| `branch_created` | a ticket branch is created or reused | `repo`, `branch`, `reused` |
| `evaluation` | the evaluator returns a verdict | `verdict`, `blocking`, `non_blocking`, `iteration` |
| `pr_prepared` | a PR description or compare link is produced | `repo`, `target`, `url` |
| `escalated` | the iteration cap is hit or the harness stops | `reason` |
| `ticket_closed` | the human confirms the work is done | `outcome` |

`stage` is one of `analyze`, `design`, `implement`, `evaluate`, `pr`, `publish`. Timestamps are UTC ISO-8601.

## `decisions.md` — decisions locked, with justification

Every decision gets a record with sequential IDs `D-1`, `D-2`, … Use `templates/decision-record.md`.

```markdown
### D-3 — Fix belongs in the service layer, not the SQL view
- **Stage:** design, iteration 1
- **Decided by:** designer · confirmed by human 2026-09-16T10:31Z
- **Options considered:** patch the view; filter in the service; add a DB constraint
- **Why:** the view is shared by three reports; filtering there changes two unrelated screens
- **Convention cited:** `sis-development-guidelines.md` → business rules live in the service, not in SQL views
- **Evidence:** `sis-product-sis-admin-backend/src/main/java/.../ApplicantService.java:212`
- **Status:** LOCKED
```

**What must become a decision record**

- The flow, branch name and source branch (`git-workflow`).
- The set of repos to change, and why each other repo is context only.
- The root cause, once the Analyzer is confident in it.
- The fix approach, and the alternatives rejected.
- The test strategy — what proves the bug is fixed, and what protects the regression surface.
- **Any deviation from a team convention**, with the justification (`engineering-standards`).
- The evaluator's verdict, with its reason.

**Locking rules**

- A record starts `LOCKED`. Later stages must follow it and cite the ID (`per D-3`).
- To change course, append a **new** decision that states why, and set the old one to `SUPERSEDED by D-n`. Never edit a locked record's substance.
- **Contradicting a locked decision without superseding it is a blocking evaluator finding**, even if the code works.

## `index.jsonl` and `current.json`

`index.jsonl` — one appended line per ticket milestone (started, verdict, closed, escalated), so `/brain` can list recent work without opening every folder:

```json
{"ts":"2026-09-16T11:52:00Z","ticket":"GSIS-12345","status":"DONE","verdict":"PASS","iterations":2,"repos":["sis-product-sis-admin-backend"],"branch":"base/bugfix/GSIS-12345-short-desc","prs":1}
```

`current.json` — overwritten, not appended, before every agent dispatch, so the telemetry collector can attribute token usage to the right ticket and stage:

```json
{"ticket":"GSIS-12345","stage":"implement","iteration":2,"started_at":"2026-09-16T11:12:00Z","session_id":"893ff923-…"}
```

Write `{}` when a ticket stops being worked on, so idle turns are not billed to the last ticket.

## Resuming a ticket

Every command that takes a ticket does this before anything else:

1. Read `state.json`, the last ~20 lines of `journal.jsonl`, and `decisions.md`.
2. Print a **resume summary** to the human:
   - status, current iteration, and `next_action`;
   - stages completed, with their artifact filenames;
   - locked decisions — ID and one line each;
   - confirmations the human already gave, noting they will not be asked again unless they say otherwise;
   - anything in `blocked_on`.
3. Append `session_resumed` and add the new session to `sessions`.
4. Continue from `status`. **Never redo a stage whose artifact already exists** unless the human asks — and if a stage is redone, write the new artifact under the next iteration number instead of overwriting.

If `state.json` is missing but the folder exists, reconstruct what you can from the journal and the artifacts, say so explicitly, and ask before continuing.

## Metrics

The telemetry collector (`hooks/scripts/telemetry.js`) writes `sis-brain/metrics/runs.jsonl`, `sis-brain/metrics/harness.prom` and each ticket's `metrics.json`. Agents and commands never write those files — they only keep `current.json` accurate. See `docs/telemetry.md`.
