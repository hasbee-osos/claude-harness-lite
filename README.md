# Claude Code Engineering Harness

A minimalist, reusable **Claude Code plugin** for enterprise **bug-fix engineering** on an existing Spring Boot + Angular + PostgreSQL product. Work starts from a Jira ticket and ends at PRs, one per changed repo, that a **human** reviews and merges.

```
/work ABC-123

Jira → Analyzer (which repos?) → Designer (plan per repo) → human confirms repos → Implementor (each repo)
     → Evaluator (each repo + cross-repo) ── PASS ──→ PRs per repo → Human Review → Human Merge
                                          └─ FAIL/INSUFFICIENT_EVIDENCE → bounded iteration (max 3) → escalate to human
```

## Workspace

The harness runs in a **workspace**: one parent folder holding the plugin, clones of all product repos, and the shared brain repo, with Claude started in that folder. The workspace folder itself is **never** a git repo — it is a plain container, and you can name it anything. A ticket may change several repos; the Analyzer works out which ones, the human confirms, and each changed repo gets the same ticket branch name and its own PRs.

```text
C:\sis-repos\                            workspace folder (any name, any path)
├── .ignore                              keeps the brain out of code searches
├── sis-brain\                           the shared brain repo (a clone)
├── claude_harness_lite\                 this plugin (skipped as a product repo)
├── sis-product-sis-admin-backend\
├── sis-product-sis-frontend\
└── …the other services…
```

- **Clone all product repos**, so the harness can follow a flow from the UI through every service.
- The plugin repo has no GitHub remote yet, so **copy** `claude_harness_lite` in rather than cloning it.
- Repos should have **no uncommitted work you care about**. The harness never touches uncommitted changes; it stops and asks if a repo it needs to change is dirty.
- **Clone the brain repo** into the workspace (see Setup). The harness also writes a workspace `.ignore` listing `sis-brain/`, which keeps harness records out of cross-repo code searches while leaving the record itself searchable.
- Nothing needs gitignoring in the workspace: it is not a git repo, so there is no `.gitignore` to get wrong.

`skills/workspace/SKILL.md` defines the model: repo discovery, `git -C` and where the brain lives; `skills/brain/SKILL.md` defines the record itself. Opening Claude inside a single repo also works (single-repo mode).

## Setup

**Prerequisites:** Claude Code installed and logged in; `git` and **Node.js on PATH** (the safety hooks run on Node, and without it they silently do nothing); each repo's own build tools (JDK + Maven/Gradle, Node/npm), because the harness runs real tests; a Jira account on the team's Atlassian site.

**1. Connect Jira** (once, from any directory — `--scope user` applies everywhere):

```powershell
claude mcp add --transport http --scope user atlassian https://mcp.atlassian.com/v2/mcp
```

Start `claude`, run `/mcp`, select `atlassian`, and complete the browser login, choosing the right site. If the connection is refused, an Atlassian admin must allow the Rovo MCP Server. Details and other servers: `mcp/jira/README.md`. The plugin bundles no MCP server and no credentials.

> **Jira is read-only in harness sessions.** The `jira-guard` hook blocks every Atlassian tool except a small list of read tools. It only works while the plugin is loaded, so don't use the Atlassian tools in sessions started without `--plugin-dir`. As a second safety net, decline any prompt to create, edit, comment on or transition an issue, and never choose "always allow" for atlassian tools.

**2. Clone the brain** (once per developer). A human creates an **empty private** GitHub repo for the team's record — e.g. `pbsgears/sis-brain` — then everyone clones it into their workspace:

```powershell
cd C:\sis-repos
git clone https://github.com/pbsgears/sis-brain.git
```

The harness seeds the repo's `.harness-brain` marker, README, `.gitignore` and `.gitattributes` on first use and commits them, and writes the workspace `.ignore` so the records stay out of code searches. It commits and pushes at every milestone from then on.

**3. Start Claude in the workspace:**

```powershell
cd C:\sis-repos
claude --plugin-dir "C:\sis-repos\claude_harness_lite"
# or add a marketplace entry pointing at this repository
```

Keep the default permission mode, so each command is approved. If `/work` is not recognized, use `/engineering-harness:work`; the same applies to the other commands.

**4. Smoke-test both guards** before the first real ticket:

- **Git guard:** pick a repo sitting on a protected branch (e.g. `base-sandbox-qa`) and ask Claude to run `git -C <that-repo-folder> commit --allow-empty -m guard-test`. It must be **blocked by engineering-harness git-guard**. If the commit goes through, stop and check that Node is on PATH and the plugin loaded. Undo a test commit with `git -C <repo> reset --soft HEAD~1`.
- **Jira guard:** ask Claude to add a comment to a ticket. It must be **blocked by engineering-harness jira-guard**. Then ask it to read the ticket and its attachments; that must work. If a read is blocked, report it to the harness maintainers (the allowlists live in `hooks/scripts/jira-guard.js`).

**Attachments need no setup.** On the first ticket with a screen recording the harness installs a pinned ffmpeg for itself under `~/.claude-harness/tools/` (about 80 MB, once per machine, via npm) unless `ffmpeg` is already on PATH. Downloads and frames stay in the OS temp folder, never in the brain or a repo — see `skills/jira-attachments/SKILL.md`.

## Commands

| Command | Purpose |
|---|---|
| `/work <ticket-id-or-url>` | Full workflow: Jira → analyze → design → implement → evaluate loop (max 3 iterations) → PRs → publish summary to Jira where supported |
| `/analyze <ticket>` | Analyzer only: root-cause analysis + which repos are involved; stops before design |
| `/design [ticket]` | Designer only: plan per repo + test strategy; requires an analysis artifact |
| `/implement [ticket]` | Implementor only: code + tests + verification in each confirmed repo; requires analysis + design |
| `/evaluate [ticket]` | Evaluator only; verdict per repo and overall: PASS / FAIL / INSUFFICIENT_EVIDENCE |
| `/brain [ticket]` | Read the record: `/brain` lists recent tickets, `/brain <ticket>` shows its timeline, locked decisions, iteration history and metrics. Read-only |
| `/pr [ticket]` | PR creation per changed repo × target, gated on evaluator PASS; without `gh`, pushes each branch and gives a prefilled GitHub compare link + description for the human to open the PR; **never merges** |

### How `/work` runs

`/work` runs the whole flow up to the first PR stage itself. It doesn't call the other commands; it dispatches the same agents directly.

```
/work GSIS-12345
  1. Read the ticket from Jira
  2. Propose flow + branch name                                ⏸ human confirms
  3. Fetch all repos; Analyzer traces the flow across repos; Designer plans per repo
  4. Show repos to change (vs context only)                    ⏸ human confirms
  5. Create the ticket branch in each changed repo
  6. Implementor → Evaluator  (FAIL → implement + evaluate again, max 3 rounds)
  7. PR stage 1: push each branch, give a compare link per repo ⏸ human opens the PRs, pastes the URLs back
  8. Publish a summary to Jira (blocked while Jira is read-only; the record stays in sis-brain/)
```

It stops and waits for the human when:
- The flow and branch name need confirmation — check both, e.g. `base/bugfix/GSIS-12345-short-desc` cut from `base-development`.
- The repos to change need confirmation. No branch is created before that.
- A repo to change has uncommitted changes, or Jira can't be read.
- The Analyzer or Designer returns `NEEDS_INPUT`.
- 3 evaluation rounds fail. An escalation report is written.
- A step needs permission, e.g. running tests, committing or pushing in the default permission mode.

On PASS it pushes each branch and gives one compare link per repo, with the PR descriptions written to `sis-brain\tickets\<ticket>\pr-<repo>-<target>.md`. The human opens the PRs and pastes the URLs back.

Run manually:
- **`/pr <ticket>` for stage 2.** Once the ticket is deployed and checked on `base-qa` in every changed repo, this raises the customer sandbox PRs for each repo. `/work` stops after stage 1, because days can pass between stages.
- **The single-stage commands**, only when wanted: to re-run one stage (e.g. `/evaluate` after a manual fix), or to review each artifact before moving on. Running `/analyze <ticket>` alone is a cheap way to check the root cause and repo list before a full run.

Re-running `/work <ticket>` after an interruption — even days later, in a new session or on another machine — resumes from the brain: it prints what is done, which decisions are locked, what the human already confirmed and what happens next, then continues from there. It never re-asks a confirmation already recorded, and never redoes a stage whose artifact exists.

Claude never merges, approves, force-pushes, pushes to protected branches, raises `base-development` PRs, or does hotfixes. Those stay with the human.

## Agents

- **Analyzer** — understands the ticket against the actual code across the workspace; marks each repo as change or context; produces a root-cause analysis with evidence. Read-only.
- **Designer** — independently verifies the analysis; produces the plan per repo, the cross-repo contracts, the **regression surface**, and a **risk-based test strategy**. Read-only.
- **Implementor** — implements the design in the confirmed repos only, applies **characterization testing** in low-coverage areas, adds the regression test, runs risk-proportionate verification in each repo, records **actual evidence** (commands + real results).
- **Evaluator** — independent quality gate over the whole work product, per repo and cross-repo; read-only; issues exactly one verdict (`PASS`, `FAIL`, `INSUFFICIENT_EVIDENCE`); only blocking findings trigger another iteration.

## Evaluator loop

`MAX_ITERATIONS = 3`. Only evaluator **blocking findings** start a new Implementor→Evaluate cycle; recommendations do not. `INSUFFICIENT_EVIDENCE` first attempts to obtain the missing evidence. After three failed iterations the harness stops and writes an escalation report for the human.

## Team guidelines the agents follow

The team's development guidelines are Markdown in this repo and are read on **every ticket**: database and Liquibase rules, base entity/service/DTO classes, authorization, deletion and usage checks, common frontend components, error handling, dates, logging. The Designer names the conventions that apply, the Implementor follows them, and the Evaluator treats an unjustified breach as a **blocking** finding even when the code works.

- `skills/engineering-standards/references/sis-development-guidelines.md` — the team's own conventions (screenshots in `images/`)
- `skills/springboot/references/java-code-review-guidelines.md` — general Java review criteria; project rules win where they differ
- `docs/maintaining-guidelines.md` — how to correct or extend a rule

## The brain — the record of every run

The brain is a **separate git repo, shared by the team**, cloned into each workspace as `sis-brain`. Every session pulls it, records as it works, and pushes at each milestone, so it is current for everyone and grows with every ticket the team runs.

```text
sis-brain/                           committed:
├── .harness-brain                   marker; git-guard allows commits here and nowhere else
├── index.jsonl                      every ticket the harness has worked on
└── tickets/<TICKET-ID>/
    ├── state.json                   status, iteration, branch, repos, PRs, and next_action
    ├── journal.jsonl                append-only event log with timestamps
    ├── decisions.md                 every decision, with its justification and evidence
    ├── analysis.md, design.md
    ├── implementation-report-1.md, evaluation-1.md, -2.md, …
    ├── pr-<repo>-<target>.md
    └── metrics.json                 what this ticket cost

                                     not committed (machine-local):
├── current.json                     which ticket this machine is on right now
└── metrics/                         runs.jsonl + harness.prom (see Telemetry)
```

Four properties make it worth keeping:

- **Resumable.** `next_action` is written in plain words on every transition, so any session can pick a ticket up — `/work <ticket>` to continue, `/brain <ticket>` to just look.
- **Traceable.** Decisions are numbered, justified, evidence-backed and **locked**. A later stage that contradicts one without superseding it is a blocking evaluator finding. When a bug is reopened months later, `decisions.md` says why the fix was built this way and which alternatives were rejected.
- **Complete.** Iteration artifacts are numbered, never overwritten, so what the evaluator caught in round 1 survives round 2.
- **Shared.** Per-ticket folders mean two developers' sessions never touch the same file, so everyone pushes to `main` directly — no PRs, no review gate, no conflicts in practice.

What never goes in: chain-of-thought, secrets, bulk file dumps, or Jira content beyond what the work needs — the record is pushed to GitHub and read by the whole team. The brain sits at the workspace root, never inside a product repo. `skills/brain/SKILL.md` is the full specification.

At the end of a run, concise final artifacts are also published to the Jira ticket **only if** the configured Jira MCP supports writes; otherwise the limitation is documented and the record stays in the brain. Jira remains the system of record for the work item; the product repos hold only the product change.

## Telemetry

A third hook, `telemetry.js`, runs when a subagent or a session ends. It reads the session transcript incrementally and records, per ticket and per stage, how many tokens each model used, how long each stage took, how many iterations ran, what the evaluator found and which repos were touched. It writes:

- `sis-brain/metrics/runs.jsonl` — one record per collection window, with the ticket and stage
- `sis-brain/metrics/harness.prom` — Prometheus textfile exposition, recomputed from the brain so the counters stay monotonic
- `sis-brain/tickets/<ticket>/metrics.json` — the per-ticket rollup `/brain` reports

Point node_exporter at `sis-brain/metrics` with `--collector.textfile.directory` and Grafana can chart first-pass rate, iterations per ticket, tokens per ticket and where the wall-clock goes. The metrics carry **no content** — counts, durations and bounded labels only, never a ticket ID, a prompt, a path or code. Claude Code's own OpenTelemetry export covers the complementary question of overall usage cost.

`docs/telemetry.md` has the metric reference, the cardinality rule, the scrape setup, the OTel variables and the panels worth building first. The collector has a self-test: `node hooks/scripts/telemetry.selftest.js`.

## Git safety

The `git-guard` PreToolUse hook blocks destructive operations (force-push, `reset --hard`, `clean -f`, …), git commit/push/merge on protected branches, and pushes whose destination is a protected branch (`HEAD:gcet-qa`, `--all`), for both the Bash and PowerShell tools. It checks the branch of the repo each git command actually targets (`git -C`, `cd`/`Set-Location`), so it works from the workspace folder, and denies git write commands whose repo it cannot determine. The harness's own record repo is the one exception: a repo whose root holds a `.harness-brain` marker may be committed and pushed to on any branch, because writing the record is the point. Force-push and history rewriting stay blocked there too, and the marker — not the folder name — is what grants it, so no product repo can inherit it. It also restricts the GitHub CLI to reads plus `gh pr create` — merging, approving, commenting, editing PRs, triggering workflows, and write `gh api` calls are denied, because `gh` runs with the human's full GitHub permissions. Both guards have self-tests (`node hooks/scripts/git-guard.selftest.js`). The branching strategy — flows, branch naming, PR targets, and the protected-branch list the hook reads — is defined only in `skills/git-workflow/SKILL.md` (source PDF and repository analysis under `references/`). To change the strategy, edit that file. The harness never merges, never approves its own PR, never bypasses checks.

A second hook, `jira-guard`, keeps Jira read-only. On Atlassian/Jira MCP servers it allows only the read tools in its allowlist, lets the generic `executeRead` through only for the named read operations the harness needs (comments, attachment downloads), and denies everything else (see `mcp/jira/README.md`; self-test `node hooks/scripts/jira-guard.selftest.js`).

## Architecture

Four agents with strictly separated responsibilities; commands orchestrate them; skills provide reusable knowledge; hooks enforce Git and Jira safety and collect telemetry; every run is recorded in the workspace brain.

```
.claude-plugin/plugin.json     plugin manifest
agents/                        analyzer, designer, implementor, evaluator
commands/                      /work /analyze /design /implement /evaluate /pr /brain
skills/                        architecture, springboot, angular, postgresql, testing,
                               engineering-standards, repository-analysis,
                               characterization-testing, git-workflow, workspace, brain,
                               jira-attachments (download attachments, frames from recordings),
                               ground-rules (the harness rules every command/agent reads first)
hooks/                         PreToolUse git-guard (protected branches, destructive ops, gh allowlist)
                               and jira-guard (read-only Atlassian MCP tools);
                               telemetry.js collects token and duration metrics
mcp/jira/README.md             read-only Jira MCP integration point
templates/                     analysis, design, implementation-report, evaluation,
                               escalation-report, decision-record, brain-readme
docs/maintaining-guidelines.md how the team edits the guidelines the agents follow
docs/telemetry.md              metrics, Prometheus scraping and Grafana panels
CLAUDE.md                      pointer for plugin developers (not loaded by plugin users)
<workspace>/sis-brain/            the shared record repo: per-ticket state, journal, decisions, artifacts
```

Model allocation: Analyzer/Designer/Evaluator run on the strongest available reasoning model; Implementor runs on a faster/cheaper model. Independence of the Evaluator from the Implementor is the important invariant.

## Piloting the harness

Judging whether the harness is worth investing in takes a handful of real tickets.

**Pick:** small, reproducible Bugs (or small Stories) with clear acceptance criteria, on the `base`, `gcet` or `gutech` line. Include at least one that touches a service **and** the UI.
**Avoid:** hotfixes, OSOS, otc/cbfs, and anything urgent.

The brain is the pilot's evidence: `sis-brain/tickets/<ticket>/` keeps the decisions, the iteration history and the metrics of every run, and `/brain <ticket>` summarises them. Keep the folder, and record:

| Question | Answer |
|---|---|
| Ticket / type | |
| Correct flow and branch proposed? | |
| Correct repos identified (none missing, none extra)? | |
| Root cause right? (analysis) | |
| Plan sensible and minimal? (design) | |
| Code quality — would you have merged it as-is? | |
| Tests meaningful and actually run in each repo? | |
| Evaluator verdict right? Any false PASS/FAIL? | |
| Iterations used / escalated? | |
| Times you had to step in, and why | |
| Time taken vs. doing it manually | |
| Anything unsafe it tried (blocked or not) | |
| Worth it? (1–5) + one-line reason | |

Multi-repo support is new and untested on real tickets; the repo selection and the cross-repo checks are exactly what a pilot should judge. If Claude's branching proposal disagrees with how the team works, or a guideline is wrong or missing, note it — those are findings about the harness, not just about the ticket.

## Limitations (by design)

- Read-only Jira: the end-of-run summary is not posted; the record stays in `sis-brain/tickets/<ticket>/`. Publishing requires an MCP with write support and a guard change; nothing is faked.
- Screen recordings are read as still frames (up to 40 per video, taken at on-screen changes): no audio, and something shown for under a second can be missed.
- Automatic PR creation requires an authenticated `gh`; otherwise the human opens each PR from a prefilled compare link.
- No orchestration server, no database, no UI — the loop runs inside Claude Code.
- PASS means "sufficient evidence for human review", not "guaranteed safe".

## Extending

- Add project skills under `skills/<name>/SKILL.md`.
- The team's development guidelines live as Markdown under `skills/*/references/` and are read on every ticket — see `docs/maintaining-guidelines.md` before changing a rule.
- Add MCP integrations per `mcp/jira/README.md` (Jira write, Git provider, CI/CD).
- Adjust protected branches in `skills/git-workflow/SKILL.md`; destructive patterns in `hooks/scripts/git-guard.js`.
- Tune agent models/effort in `agents/*.md` frontmatter.
