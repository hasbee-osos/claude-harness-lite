---
name: brain
description: The single specification of how the brain is written - the team's shared git repo, cloned into the workspace as sis-brain, holding the durable per-ticket record of every harness run. Covers the layout, what each stage records, state.json, the journal, locked decisions, the index, syncing, resuming a ticket, metrics, the leadership dashboard, and what must never be written there. Read by the orchestrating commands before they write or read the record; agents return their artifacts and do not write here.
---

# The Brain

The **brain** is the team's shared record: a git repo cloned into the workspace as `sis-brain`, with one folder per ticket recording what the harness did, what it decided, why, and what it took. Every session pulls it, writes to it and pushes, so any session — days later, a different person, a different machine — can read it and pick up exactly where the last one stopped. Leadership reads the same record through the dashboard.

**This file is the only specification of how the brain is written.** Commands, agents, other skills and templates refer here instead of repeating paths, fields or events. To change how the brain is recorded, change this file — and, if a field or event is added, `sis-brain/dashboard/build.js` and `hooks/scripts/telemetry.js` if they read it.

## Layout

```text
<workspace>/sis-brain/            ← a clone of the team's brain repo
├── .harness-brain             ← marker; git-guard allows commits and pushes here
├── .gitignore                 ← metrics/ , current.json , dashboard/dist/ , codebase/generated/
├── .gitattributes             ← *.jsonl merge=union
├── README.md                  ← seeded on first run from templates/brain-readme.md
├── index.jsonl                ← one line per ticket milestone (append-only, shared)
├── current.json               ← live pointer: which ticket/stage is running now — NOT committed
├── metrics/                   ← NOT committed; Prometheus reads these from disk
│   ├── runs.jsonl             ← one record per collection window (telemetry)
│   └── harness.prom           ← Prometheus textfile exposition
├── dashboard/                 ← the leadership dashboard (see Dashboard)
│   ├── build.js, template.html, prices.json   ← committed
│   ├── artifact.json          ← the published page's URL — committed
│   └── dist/                  ← generated page and costs.json — NOT committed
├── codebase/                  ← the codebase map (see Codebase map)
│   ├── README.md, build.js, repos.json   ← committed
│   ├── <repo>.md              ← hand-written notes per repo — committed
│   └── generated/             ← indexes rebuilt after each fetch — NOT committed
└── tickets/<TICKET-ID>/       ← "the ticket folder"
    ├── state.json             ← the resume point
    ├── journal.jsonl          ← append-only event log
    ├── decisions.md           ← locked decisions with justification
    ├── plan.md                ← a later revision is plan-2.md, … (tickets started before v0.4 have analysis.md and design.md instead)
    ├── qa-packet.md | sme-packet.md  ← paste-ready Jira comment when a stage needs answers (input-packets)
    ├── implementation-report-1.md, -2.md, …
    ├── evaluation-1.md, -2.md, …
    ├── escalation-report.md
    ├── pr-<repo>-<target>.md
    └── metrics.json           ← per-ticket rollup (written by telemetry)
```

- **The ticket folder is always `sis-brain/tickets/<TICKET-ID>/`**, flat, keyed only by the Jira key. It never moves. Epic, sprint, assignee and work type are **data in `state.json`**, not folders: tickets change sprint and even work type, and a folder that moves breaks resumes and causes conflicts. Grouping by sprint or epic is the dashboard's job.
- **The brain is its own git repo**, shared by the team and cloned into the workspace as `sis-brain`. The workspace folder around it is a plain container and is never version-controlled.
- **Never inside a product repo.** The brain sits at the workspace root, beside the repo clones. If `sis-brain` is missing or is not a git repo, say so and ask the human to clone it — do not silently start a local-only brain.
- **Iteration artifacts are numbered, never overwritten.** `evaluation-1.md` survives iteration 2. `state.json` `artifacts` records the latest of each.
- **Keep the brain out of code searches.** The workspace needs a `.ignore` file at its root containing `sis-brain/`. ripgrep honours `.ignore`, so cross-repo code searches stop returning harness records as matches. `Grep` with an explicit path into the brain still works. Create the file on first use if it is missing, or append the line if it exists without it. It sits in the workspace, which is not a git repo, so there is nothing to commit.
- **On first use**, seed anything missing at the repo root — `.harness-brain`, `README.md` (from `templates/brain-readme.md`), `.gitignore` and `.gitattributes` as above — and commit them.

## What each stage records

Every write to the brain happens at one of these moments. Commands say *when* a moment happens; this table says *what* is recorded. Always update `updated_at`, and write `next_action` in plain words whenever `status` changes. Wrap every agent dispatch in `stage_start` / `stage_end` and overwrite `current.json` just before it.

| Moment | Files written in the ticket folder | Journal events | `state.json` fields | Commit and push |
|---|---|---|---|---|
| **Ticket started** (no folder yet) | create the folder, `state.json` | `ticket_started` | everything known, including `jira` (see below), `status: PLANNING` | `<ID>: ticket started` |
| **Session resumed** | — | `session_resumed` | append to `sessions`; refresh `jira` | only with the next milestone |
| **Work type, line and branch confirmed** | `decisions.md` (routing decision stating the work type and the Customer Name it came from) | `human_confirmed`, `decision_locked` | `work_type`, `line`, `customer_name`, `source_branch`, `branch`, `pr_target`, `human_confirmations` | `<ID>: line and branch confirmed` |
| **Plan written** | `plan.md` (revision → `plan-2.md`); `decisions.md` (root cause or scope; and, once Part 2 is written, approach, test strategy, contract or schema choices, deviations); the input packet for NEEDS_INPUT | `stage_start`, `stage_end` (stage `plan`), `decision_locked`, and `input_requested` if blocked | `plan`, `artifacts`, `status` (`AWAITING_REPO_CONFIRMATION` or `NEEDS_INPUT`), `blocked_on` | `<ID>: plan written - READY` / `- NEEDS_INPUT` |
| **Answers received** for a packet | — | `input_received` | clear `blocked_on`, `status` | with the next milestone |
| **Repos and track confirmed** | `decisions.md` (repo set; track with its reason) | `human_confirmed` (`repos_to_change`, `track`), `decision_locked` | `repos`, `context_repos`, `track`, `max_iterations` (evaluation rounds: 1 light, 2 full), `human_confirmations`, `status: IMPLEMENTING` | `<ID>: repos and track confirmed` |
| **Track changed** (light → full) | `decisions.md` (new track decision superseding the old) | `human_confirmed`, `decision_locked`, `decision_superseded` | `track: full`, `max_iterations: 2`, `status: PLANNING` | `<ID>: moved to full track` |
| **Branch created or reused** (per repo) | — | `branch_created` | `repos.<repo>.branch_created` | `<ID>: branches created` (once, after all repos) |
| **Implementation reported** | `implementation-report-<n>.md`; `decisions.md` for any convention deviation | `stage_start`, `stage_end`, `decision_locked` if any | `implementation`, `artifacts`, `status: EVALUATING` (after the **final fix round**: `repos.<repo>.final_head` and `status` stays `IMPLEMENTING` until PRs are prepared) | `<ID>: implementation <n>` (final round: `<ID>: final fix round - <k> of <m> findings closed`) |
| **Evaluation returned** | `evaluation-<n>.md`, `decisions.md` (verdict) | `stage_start`, `stage_end`, `evaluation`, `decision_locked` | `evaluation`, `artifacts`, `status`, `repos.<repo>.evaluated_head` (the commit evaluated in each repo) | `<ID>: evaluation <n> - <VERDICT>, <k> blocking` |
| **New iteration** | — | `iteration_start` | `iteration` | with the next milestone |
| **Escalated** (the final fix round could not close a finding, or the harness stops) | `escalation-report.md` | `escalated` | `status: ESCALATED` | `<ID>: escalated` |
| **PRs prepared** | `pr-<repo>-<target>.md` per repo | `pr_prepared` per repo | `prs`, `status: PR_STAGE_1` | `<ID>: PRs prepared` |
| **Run stops** (any reason) | — | — | `next_action` | `index.jsonl` line; write `{}` to `current.json`; `<ID>: <what happened>`; then publish the dashboard (see Dashboard) |
| **Ticket closed** (human confirms done) | — | `ticket_closed` | `status: DONE` | `index.jsonl` line; `<ID>: closed` |
| **Codebase notes corrected** (an artifact has Codebase map corrections) | `codebase/<repo>.md` outside the ticket folder (see Codebase map) | — | — | `codebase: <repo> notes - <ID>`, a commit of its own |

### Input packets

When a stage stops on questions (`input-packets`), record with that stage: `artifacts.qa_packet` or `artifacts.sme_packet` set to the packet filename; `status: NEEDS_INPUT`; `blocked_on: "answers to <packet> Q1–Qn"`; `next_action: "Developer posts <packet> as a Jira comment on <ticket>; when answered, run /work <ticket>"`; and an `input_requested` event. Questions only a developer can answer get `audience: developer` and `packet: null`. On **Answers received**, append `human_confirmed` with `what: "<packet> answers"` and the confirmed values, then `input_received`, and clear `blocked_on`.

### Index lines

The `index.jsonl` line is appended at **started**, every **NEEDS_INPUT** stop, every **evaluation verdict**, **escalated** and **closed** — the moments a reader scanning recent work cares about.

## Syncing

The brain is shared, so every session keeps it current. All of this runs as `git -C <workspace>/sis-brain …`.

- **Pull before reading.** `git -C sis-brain pull --rebase` when a ticket starts or resumes, so you see what colleagues have recorded.
- **Commit and push at every milestone** in the table above, not only at the end. A session that dies mid-ticket must leave nothing stranded on one machine.
- **Commit message:** `<TICKET-ID>: <milestone>` as in the table. One ticket per commit; never mix two tickets.
- **Rejected push?** `git -C sis-brain pull --rebase`, then push again. **Never force-push and never rewrite history** — git-guard blocks both here as everywhere else.
- **Conflicts are rare by design.** Each ticket owns its folder, so two people on two tickets never collide. `index.jsonl` is shared but append-only, and `merge=union` resolves it automatically. A genuine conflict means two sessions worked the same ticket: stop and ask the human which record is right.
- Everyone commits straight to `main`. The brain is a record, not code — there is no review gate, because a gate would stop it being current.
- `metrics/`, `current.json`, `dashboard/dist/` and `codebase/generated/` are machine-local and gitignored. `tickets/<id>/metrics.json` **is** committed: it is what that ticket used.

## What must never be written to the brain

This record is pushed to GitHub, read by the whole team and summarised for leadership, so the list is not advisory.

- **Chain-of-thought.** Record conclusions, decisions and evidence — not reasoning transcripts.
- **Secrets, credentials, tokens, connection strings** — in any artifact, journal line or PR description.
- **Bulk file dumps.** Cite `<repo>/<path>:<line>`; do not paste files.
- **Jira content beyond what the work needs** — the summary, the acceptance criteria that matter, the epic, sprint and assignee, and the ticket link. Not whole comment threads, not other personal data.
- Anything a teammate opening the folder in six months should not be reading.

## `state.json`

```json
{
  "schema_version": 3,
  "ticket": "GSIS-12345",
  "jira": {
    "url": "https://gearsjira.atlassian.net/browse/GSIS-12345",
    "title": "Applicant list shows withdrawn applicants",
    "issue_type": "Bug",
    "epic": { "key": "GSIS-2491", "name": "Exam Controller App" },
    "sprint": { "name": "Sustainment Sprint 21", "start": "2026-09-16", "end": "2026-09-29" },
    "assignee": "Display Name",
    "estimate": "3h",
    "refreshed_at": "2026-09-16T09:10:00Z"
  },
  "status": "PLANNING | AWAITING_REPO_CONFIRMATION | IMPLEMENTING | EVALUATING | PR_STAGE_1 | PR_STAGE_2 | DONE | NEEDS_INPUT | ESCALATED",
  "next_action": "Re-run the implementor with the blocking findings E-1 and E-3 from evaluation-2.md",
  "blocked_on": null,
  "created_at": "2026-09-16T09:10:00Z",
  "updated_at": "2026-09-16T11:42:00Z",
  "iteration": 2,
  "max_iterations": 2,
  "track": "light | full",
  "workspace": "C:/sis-workspace",
  "work_type": "bug | feature",
  "line": "base | gcet | gutech",
  "customer_name": "Product Core Feature",
  "source_branch": "base-development",
  "branch": "base/bugfix/GSIS-12345-short-desc",
  "repos": {
    "sis-product-sis-admin-backend": { "role": "change", "branch_created": true, "evaluated_head": "3f9c2e1", "final_head": null },
    "sis-product-sis-frontend":      { "role": "change", "branch_created": true, "evaluated_head": "a41d07b", "final_head": null }
  },
  "context_repos": ["sis-product-sis-student-service"],
  "pr_target": "base-sandbox-qa",
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
    { "what": "line_and_branch", "at": "2026-09-16T09:18:00Z", "value": "Customer Name 'Product Core Feature' → line base, base/bugfix/GSIS-12345-short-desc, source base-development, PR to base-sandbox-qa" },
    { "what": "repos_to_change", "at": "2026-09-16T10:31:00Z", "value": ["sis-product-sis-admin-backend", "sis-product-sis-frontend"] }
  ],
  "decisions": ["D-1", "D-2", "D-3"],
  "artifacts": {
    "plan": "plan.md",
    "qa_packet": "qa-packet.md",
    "implementation": "implementation-report-2.md",
    "evaluation": "evaluation-2.md"
  },
  "plan": "READY | NEEDS_INPUT",
  "implementation": "COMPLETE | BLOCKED",
  "evaluation": "PASS | FAIL | INSUFFICIENT_EVIDENCE"
}
```

- **`jira`** is read from the Jira issue when the ticket starts and **refreshed on every resume**, because the sprint and assignee change while the folder does not. `epic` comes from the issue's parent (or Epic Link) when that parent is an Epic; a Sub-task takes its parent story's epic. `sprint` is the issue's open (active or future) sprint, else the most recent closed one. Use `null` for anything the issue does not have — never guess. Record only the assignee's display name. `estimate` is the issue's *Dev Lead Estimation* field exactly as written in Jira (for example `3h` or `1d 4h`), or `null` if it is empty. The dashboard compares it with the AI's working time.
- `line`, `source_branch`, `branch` and `pr_target` follow `git-workflow` → The routing decision, are derived from the issue's `customer_name`, and are the same for every changed repo.
- The PR stage is done only when **every** changed repo has its PR merged and the human confirms verification. Everything after that — promotion to the QA environment, any port onto another line, the post-QA merge into `base-development` — is human work and is not tracked here.
- `track` and `max_iterations` are set when the human confirms the repos and track (`harness-core` → Tracks). `max_iterations` counts evaluation rounds (light 1, full 2); after the last one, a failing ticket gets one final fix round that is not evaluated. `evaluated_head` is each changed repo's `HEAD` when the evaluator ran, and `final_head` its `HEAD` after the final fix round; a PR is raised only while `HEAD` still equals the one the gate accepted. A track forced with `--lite` is recorded in the track decision and in `human_confirmations` as `track: light (forced with --lite)`.
- A `schema_version: 1` file has no `jira` block (it may have a top-level `jira_url`). On resume, add the block.
- A `schema_version: 2` ticket was worked by the old Analyzer and Designer. On resume, keep its `analysis.md` and `design.md` as they are (never rename them); map status `ANALYZING` or `DESIGNING` to `PLANNING`; if it has no design yet, run the Planner with the existing analysis as input, and it writes `plan.md`; if it already has one, treat the design as the plan and set `track: full`. Then set `schema_version: 3`.

## `journal.jsonl` — append-only

One JSON object per line. Never rewrite or delete a line; a mistake is corrected by appending, not by editing.

```json
{"ts":"2026-09-16T09:10:00Z","event":"ticket_started","ticket":"GSIS-12345","session_id":"893ff923-…"}
{"ts":"2026-09-16T10:02:11Z","event":"stage_start","stage":"plan","iteration":1}
{"ts":"2026-09-16T10:31:02Z","event":"decision_locked","id":"D-3","summary":"Fix in the service layer, not the SQL view"}
{"ts":"2026-09-16T10:31:44Z","event":"human_confirmed","what":"repos_to_change","value":["sis-product-sis-admin-backend"]}
{"ts":"2026-09-16T11:05:18Z","event":"evaluation","verdict":"FAIL","blocking":2,"non_blocking":1,"iteration":1}
{"ts":"2026-09-16T11:40:57Z","event":"pr_prepared","repo":"sis-product-sis-frontend","stage":1,"target":"base-sandbox-qa","url":null}
```

Event vocabulary — a closed set. Do not invent events; add one here first.

| Event | When | Required fields |
|---|---|---|
| `ticket_started` | first time the ticket is touched | `ticket`, `session_id` |
| `session_resumed` | a new session picks the ticket up | `session_id`, `from_status` |
| `stage_start` / `stage_end` | before and after each agent or command stage | `stage`, `iteration` |
| `iteration_start` | a new implement/evaluate cycle begins | `iteration`, `reason` |
| `human_confirmed` | the human approves something the harness paused for | `what`, `value` |
| `input_requested` | a stage stops on questions and a packet is written | `audience` (`qa`, `sme` or `developer`), `packet` (filename or null), `questions` (count) |
| `input_received` | the answers are read back and confirmed | `audience`, `packet` |
| `decision_locked` | a decision record is added | `id`, `summary` |
| `decision_superseded` | a locked decision is replaced | `id`, `superseded_by` |
| `branch_created` | a ticket branch is created or reused | `repo`, `branch`, `reused` |
| `evaluation` | the evaluator returns a verdict | `verdict`, `blocking`, `non_blocking`, `iteration` |
| `pr_prepared` | a PR description or compare link is produced | `repo`, `stage`, `target`, `url` |
| `escalated` | the iteration cap is hit or the harness stops | `reason` |
| `ticket_closed` | the human confirms the work is done | `outcome` |

`stage` is one of `plan`, `implement`, `evaluate`, `pr`, `publish` (`analyze` and `design` appear in tickets recorded before v0.4). Timestamps are UTC ISO-8601. Durations are measured from these events, so write `stage_end` as soon as the stage's artifact is written, not later.

## `decisions.md` — decisions locked, with justification

Every decision gets a record with sequential IDs `D-1`, `D-2`, … Use `templates/decision-record.md`.

```markdown
### D-3 — Fix belongs in the service layer, not the SQL view
- **Stage:** plan, iteration 1
- **Decided by:** planner · confirmed by human 2026-09-16T10:31Z
- **Options considered:** patch the view; filter in the service; add a DB constraint
- **Why:** the view is shared by three reports; filtering there changes two unrelated screens
- **Convention cited:** `engineering-standards` → business rules live in the service, not in SQL views
- **Evidence:** `sis-product-sis-admin-backend/src/main/java/.../ApplicantService.java:212`
- **Status:** LOCKED
```

**What must become a decision record**

- The work type, line, branch name, source branch and PR target (`harness-core`, `git-workflow`).
- The set of repos to change, and why each other repo is context only.
- The track (light or full), with the reason against `harness-core` → Tracks; moving to full supersedes it.
- **bug:** the root cause, once the Planner is confident in it. **feature:** the scope — acceptance criteria in, explicitly out, assumptions — once confirmed; and a slicing decision or a recorded override when a story is too big.
- The fix or design approach, and the alternatives rejected; for a feature, also each new contract or schema choice worth defending later.
- The test strategy — what proves the bug is fixed or each acceptance criterion is met, and what protects the regression surface.
- **Any deviation from a team convention**, with the justification (`engineering-standards`).
- The evaluator's verdict, with its reason.

**Locking rules**

- A record starts `LOCKED`. Later stages must follow it and cite the ID (`per D-3`).
- To change course, append a **new** decision that states why, and set the old one to `SUPERSEDED by D-n`. Never edit a locked record's substance.
- **Contradicting a locked decision without superseding it is a blocking evaluator finding**, even if the code works.

## `index.jsonl` and `current.json`

`index.jsonl` — one appended line per ticket milestone (see the table above), so `/brain` can list recent work without opening every folder:

```json
{"ts":"2026-09-16T11:52:00Z","ticket":"GSIS-12345","title":"Applicant list shows withdrawn applicants","work_type":"bug","track":"light","epic":"GSIS-2491","sprint":"Sustainment Sprint 21","status":"DONE","verdict":"PASS","iterations":2,"repos":["sis-product-sis-admin-backend"],"branch":"base/bugfix/GSIS-12345-short-desc","prs":1}
```

`current.json` — overwritten, not appended, before every agent dispatch, so the telemetry collector can attribute token usage to the right ticket and stage:

```json
{"ticket":"GSIS-12345","stage":"implement","iteration":2,"started_at":"2026-09-16T11:12:00Z","session_id":"893ff923-…"}
```

Write `{}` when a ticket stops being worked on, so idle turns are not billed to the last ticket.

## Finding the ticket when none is named

`/work` accepts an omitted ticket ID. Use the ticket in `current.json` if it names one; otherwise the ticket of the last line of `index.jsonl`; otherwise the ticket folder with the newest `state.json` `updated_at`. Say which ticket was picked and why before acting.

## Resuming a ticket

Every command that takes a ticket does this before anything else:

1. `git -C sis-brain pull --rebase`, then read `state.json`, the last ~20 lines of `journal.jsonl`, and `decisions.md`.
2. Print a **resume summary** to the human:
   - status, current iteration, and `next_action`;
   - stages completed, with their artifact filenames;
   - locked decisions — ID and one line each;
   - confirmations the human already gave, noting they will not be asked again unless they say otherwise;
   - anything in `blocked_on`.
3. Append `session_resumed`, add the new session to `sessions`, and refresh `jira`.
4. Continue from `status`. **Never redo a stage whose artifact already exists** unless the human asks — and if a stage is redone, write the new artifact under the next iteration number instead of overwriting.

If `state.json` is missing but the folder exists, reconstruct what you can from the journal and the artifacts, say so explicitly, and ask before continuing.

## Metrics

The telemetry collector (`hooks/scripts/telemetry.js`) writes `metrics/runs.jsonl`, `metrics/harness.prom` and each ticket's `metrics.json`. Agents and commands never write those files — they only keep `current.json` and the journal accurate. See `docs/telemetry.md`.

`metrics.json` keeps token usage **per session**, because `runs.jsonl` is machine-local: a colleague's machine only knows its own sessions, so the collector replaces the sessions it knows and keeps the rest. Totals are recomputed from the sessions; stage durations, iterations and verdicts are recomputed from the journal, which every machine shares.

```json
{
  "ticket": "GSIS-12345",
  "updated_at": "2026-09-16T11:52:00Z",
  "sessions": {
    "893ff923-…": { "turns": 35, "tokens_by_stage": { "plan": { "input": 74, "output": 14808, "cache_read": 1854099, "cache_creation": 226590, "thinking": 1609 } }, "tokens_by_model": { "claude-opus-5": { "…": 0 } } }
  },
  "tokens": { "input": 0, "output": 0, "cache_read": 0, "cache_creation": 0, "thinking": 0 },
  "tokens_by_stage": {}, "tokens_by_model": {}, "turns": 0,
  "stage_seconds": { "plan": 505 },
  "iterations": 0, "verdicts": {}, "findings": { "blocking": 0, "non_blocking": 0 }
}
```

`thinking` is already included in `output`; never add the two.

## Codebase map

`codebase/` saves each ticket from rediscovering the same screens, endpoints and tables. It is a **hint, not evidence**: agents use it to find files quickly, then read and cite the code. `codebase/README.md` in the brain tells agents how to use it.

- **Generated indexes.** `codebase/build.js` reads every repo in `codebase/repos.json` through git, never the checkout, and writes `codebase/generated/`. It reads each repo at `--ref` when given, and otherwise at the repo's `ref` in `repos.json`. A repo without the `--ref` branch falls back to its own ref and says so. The folder is gitignored, and `generated/stamp.json` records the branch and commit each repo was read at. It holds screens (menu label per customer line → route → component → the API services it injects), frontend services → backend controllers, routes, components, endpoints with their grants, tables, menus and outbound clients. It extracts names and paths only, never config values.
- **Rebuild** at `/work` step 5, after the fetch and at the ticket's source branch: `node sis-brain/codebase/build.js --ref origin/<source_branch>`. A customer-line ticket then sees that line's screens, endpoints and tables, not only base's. If the output reports a fallback, pass that line to the Planner. This is best-effort. If `build.js` is missing, skip it silently. If it fails, say so in one line, carry on, and tell the Planner the map may be stale.
- **Hand-written notes**, `codebase/<repo>.md`, about one page per repo: layout, where things live, build and test commands, known pitfalls. Only facts checked against the code or a real run.
- **Corrections.** A plan or implementation report may end with **Codebase map corrections**. The orchestrator applies each correction to the notes, keeping them short, replacing the wrong fact rather than appending, and writing nothing from the ticket beyond the fact itself. It commits the change separately as `codebase: <repo> notes - <TICKET-ID>`. A gap in a generated index can't be fixed in the notes; tell the human it is a `build.js` gap for the brain's maintainers.
- **Adding a repo** means an entry in `repos.json` (`kind`: `angular` or `spring`), a notes file, and a check of its generated indexes. That is a maintainer's change, not a ticket's.

## Dashboard

The dashboard is a private page on claude.ai that shows leadership how the harness worked each ticket: what is in progress and who it is waiting on, delivery by sprint and epic, what it delivered (PRs, tickets resolved without a code change), what the Evaluator caught before any PR, decisions recorded, AI working time by stage against the Jira estimate, and where the elapsed time went: the AI working, waiting on QA or an SME for packet answers, waiting on the developer, or idle. Per ticket it shows the timeline, locked decisions, iterations and PRs. It is built entirely from the committed files above — nothing machine-local — so any clone of the brain produces the same page.

- `dashboard/build.js` reads the brain and writes `dashboard/dist/index.html` (the page with the data embedded). Node only, no dependencies.
- **No money figures on the page.** The team uses a Claude subscription, so a token-priced dollar amount would read to leadership as a bill. The data is kept: `dashboard/prices.json` holds list API prices per model, and each build writes the API-equivalent cost per ticket and stage to `dashboard/dist/costs.json` and prints the total in its summary, for the maintainers. It is never embedded in or published with the page. Tokens stay in each ticket's committed `metrics.json`.
- `dashboard/artifact.json` holds the published page's URL and owner. **Only the owner can update the page**; everyone else can view it.
- The page is as current as the last publish. Publishing never changes a ticket record.

### Publishing

The dashboard is republished in two ways, both following the same steps:

- **`/brain publish`** — on demand. It may also make the **first** publish, which creates the page and `artifact.json`.
- **When a run stops** — the last step of **Run stops**, after the brain is pushed, so the page shows the run's latest milestone without anyone remembering to publish. It is best-effort: it never makes the first publish, never commits, never asks the human anything, and never fails or delays the run's result. If any step below cannot be done — no `dashboard/build.js`, no `url` in `artifact.json`, no Artifact tool in the session, the build fails, or the publish is refused because this person is not the owner — skip publishing and say so in one line (for example "Dashboard not refreshed: only its owner can publish; it will catch up at their next publish"). A colleague's run is still pushed to the brain and appears at the owner's next publish.

Steps:

1. Run `node sis-brain/dashboard/build.js`. It prints the output path, `sis-brain/dashboard/dist/index.html`, and a one-line summary.
2. Read the whole generated file before publishing it.
3. If this session has not yet read or published the page, read it once with the Artifact tool (`action: "read"`, the `url` from `artifact.json`); a publish to a page the session has not read is refused.
4. Publish the generated file to that `url`. Never publish without `url` except for the first publish from `/brain publish`: it would create a second page.
5. `/brain publish` only: set `published_at` in `artifact.json`, commit `dashboard: publish`, and push.
