# Claude Code Engineering Harness — developer cookbook

A Claude Code plugin that takes a **Jira bug or story** on the SIS product (Spring Boot + Angular + PostgreSQL) from ticket to **PRs that you review and merge**. You run one command, `/work <ticket>`. The harness plans the change against the real code, implements it, has an independent evaluator check it, and hands you compare links. It pauses for your confirmation at every decision that matters, and it records everything in a shared repo called **the brain**.

```
/work GSIS-12345

Jira → Planner → you confirm repos + track → Implementor → Evaluator ── PASS ──→ PRs → you review and merge
                                                  └── FAIL → fix → (full only: evaluate again) → final fix → PRs → you review the final fixes
```

Claude never merges, approves, force-pushes, pushes to protected branches or writes to Jira. Those stay with you.

---

## 1. Set up (once per developer)

**Prerequisites:** Claude Code installed and logged in; `git`; **Node.js on PATH** (the safety hooks need it and do nothing silently without it); each repo's build tools (JDK + Maven/Gradle, Node/npm), because the harness runs real tests; a Jira account on the team's Atlassian site.

### 1.1 Create the workspace

The workspace is one plain folder (not a git repo) holding every product repo and the brain. Start Claude from there.

```text
C:\sis-repos\                      any name, any path
├── .ignore                        written by the harness, keeps sis-brain out of code searches
├── sis-brain\                     the shared brain repo
├── sis-product-sis-admin-backend\
├── sis-product-sis-frontend\
└── …every other product repo…
```

Clone **all** product repos so the harness can follow a flow from the UI through every service. Commit or stash any work you care about first; the harness stops if a repo it has to change is dirty.

### 1.2 Connect Jira (MCP)

```powershell
claude mcp add --transport http --scope user atlassian https://mcp.atlassian.com/v2/mcp
```

Start `claude`, run `/mcp`, choose `atlassian` and complete the browser login on the right site. If it is refused, an Atlassian admin must allow the Rovo MCP Server. More detail: [`mcp/jira/README.md`](mcp/jira/README.md).

Jira is **read-only** in harness sessions: the `jira-guard` hook blocks everything except reads. Never choose "always allow" for Atlassian tools.

### 1.3 Clone the brain

```powershell
cd C:\sis-repos
git clone https://github.com/hasbee-osos/sis-brain.git
```

### 1.4 Install the plugin

```powershell
claude plugin marketplace add hasbee-osos/claude-harness-lite
claude plugin install engineering-harness@sis-harness
```

Check it with `claude plugin list`. Do not clone or copy the harness into the workspace to use it.

### 1.5 Smoke-test the guards (before your first ticket)

- **Git guard:** ask Claude to run `git -C <repo-on-a-protected-branch> commit --allow-empty -m guard-test`. It must be blocked by `git-guard`. If it goes through, Node is missing or the plugin didn't load. Undo it with `git -C <repo> reset --soft HEAD~1`.
- **Jira guard:** ask Claude to comment on a ticket. It must be blocked by `jira-guard`. Reading the ticket and its attachments must still work.

Screen recordings need no setup. The first time one comes up, the harness installs its own ffmpeg under `~/.claude-harness/tools/`.

### Updating the harness

When a harness PR is merged:

```powershell
claude plugin marketplace update sis-harness
claude plugin update engineering-harness@sis-harness
```

Then run `/reload-plugins` or restart Claude. An update only arrives if the PR raised `version` in `.claude-plugin/plugin.json`.

---

## 2. Everyday use

```powershell
cd C:\sis-repos
claude
```

Use no extra flags, and keep the default permission mode so you approve each command. If `/work` isn't recognised, use `/engineering-harness:work`.

### Commands

| Command | What it does |
|---|---|
| `/work <ticket-id-or-url>` | Moves the ticket forward from wherever it stands: plan → implement ⇄ evaluate → PRs. Re-run it to continue after any stop, even days later or on another machine |
| `/work <ticket> plan` | Stops once the plan is written. Use it as a cheap check of the root cause or scope and the repos before a full run |
| `/work <ticket> --lite` | Forces the light track: one evaluation round, then a final fix round, then PRs. The Planner still flags anything that would normally make it full |
| `/work` | No ticket given: continues the ticket you were last working on |
| `/brain` | Lists recent tickets from the brain. Read-only |
| `/brain <ticket>` | Shows a ticket's status, timeline, locked decisions, iterations, token usage and PRs. Read-only |
| `/brain publish` | Rebuilds and republishes the leadership dashboard. `/work` also does this whenever a run stops |

### What `/work` does, and where it waits for you

```
1. Reads the ticket from Jira (attachments and recordings included)
2. Proposes the work type, flow and branch name          ⏸ you confirm
3. The Planner traces the code across all repos and writes the plan
4. Shows the repos to change and the proposed track      ⏸ you confirm (no branch exists before this)
5. Creates the same ticket branch in each changed repo
6. Implementor → Evaluator (light: 1 round, full: 2); a remaining FAIL gets one final fix round, which you review in the PR
7. PASS: pushes the branches and gives one compare link per repo   ⏸ you open the PRs and paste the URLs back
8. After base-qa verification, a later /work raises the customer-sandbox PRs (PR stage 2)
```

It also stops when:

- **The Planner needs answers** (`NEEDS_INPUT`). It writes a short, paste-ready Jira comment to the ticket's brain folder: `qa-packet.md` for a bug, `sme-packet.md` for a story. Post it on the ticket. Once it's answered, run `/work <ticket>` again; the harness reads the answers from Jira and asks you to confirm them.
- **A light ticket turns out bigger than planned.** You decide whether it moves to the full track.
- **The final fix round cannot close a blocking finding.** It writes an `escalation-report.md` and hands the ticket back to you.
- **A repo is dirty, or Jira can't be read.**

If you fix something by hand on the ticket branch, `/work` re-evaluates before it raises any PR.

---

## 3. Light and full tracks

The Planner proposes a track and you confirm it together with the repos, or you force light with `--lite`. The Evaluator runs at least once on both, and every change gets unit tests for each method or component it touches.

| | **Light** | **Full** |
|---|---|---|
| Fits | A bug with a proven root cause, or a story with at most 3 confirmed acceptance criteria. At most 2 repos, at most an additive contract change. No new entity, workflow or notification event. Nothing that touches auth, deletion checks or existing rows | Everything else |
| Plan | Full understanding; the change, tests and AC coverage in a few lines | Every section in full, including cross-repo contracts and the regression surface |
| Flow | implement → evaluate → final fix → PR | implement → evaluate → implement → evaluate → final fix → PR |
| Evaluation rounds | 1 | 2 |

The exact criteria are in [`skills/harness-core/SKILL.md`](skills/harness-core/SKILL.md) → Tracks.

**Agents:** the **Planner** works out the root cause or scope, the repos and the plan; it is read-only. The **Implementor** makes the change, adds a regression test for a bug or a test per acceptance criterion for a story, and records the real test output. The **Evaluator** is an independent, read-only quality gate that returns `PASS`, `FAIL` or `INSUFFICIENT_EVIDENCE`.

**Team conventions** are applied on every ticket, and the Evaluator treats an unjustified breach as blocking. They live in [`skills/engineering-standards/`](skills/engineering-standards/SKILL.md) (backend, frontend, database). To change a rule, see [`docs/maintaining-guidelines.md`](docs/maintaining-guidelines.md).

---

## 4. The brain

Every `/work` run is recorded in **`sis-brain`**, a separate git repo that the whole team shares. The harness pulls it when a ticket starts or resumes, writes as it works, and commits and pushes to `main` at every milestone, so anyone can pick up any ticket where it stopped.

Each ticket gets one folder, `tickets/<TICKET-ID>/`, which holds:

- `state.json`: where the ticket stands, with `next_action` in plain words.
- `journal.jsonl`: the append-only timeline.
- `decisions.md`: the numbered, locked decisions with their evidence.
- The plan, implementation reports, evaluations, PR descriptions and any QA/SME packet.
- `metrics.json`: tokens and time used.

The same files feed a leadership dashboard on claude.ai. It shows what was delivered, what the Evaluator caught, AI working time against the Jira estimate, and where the elapsed time went (AI working, waiting on QA/SME, waiting on the developer, idle). It shows no money figures, because the AI runs on the team's subscription.

The brain also holds the **codebase map**, `codebase/`. It has short notes per repo (layout, where things live, build and test commands, pitfalls), plus indexes rebuilt after every fetch that link a screen's menu label to its route, component, API and controller. The Planner and Implementor start from it instead of rediscovering the code each ticket, but they still cite the code itself. When they find the map wrong, the notes are corrected. It is being piloted on the frontend and admin-backend.

You never edit ticket records by hand. Read it with `/brain`, and for a reopened ticket start with its `decisions.md`.

**For details, read the brain's own [`README.md`](https://github.com/hasbee-osos/sis-brain#readme).** The full specification of how the brain is written is [`skills/brain/SKILL.md`](skills/brain/SKILL.md).

---

## 5. Good to know

- **Safety hooks:**
  - `git-guard` blocks destructive git, commits and pushes on protected branches, and `gh` writes other than `gh pr create`. The branching strategy is in [`skills/git-workflow/SKILL.md`](skills/git-workflow/SKILL.md).
  - `jira-guard` keeps Jira read-only.
  - `telemetry.js` records tokens and durations per ticket and stage ([`docs/telemetry.md`](docs/telemetry.md)).
- **Limitations:**
  - No summary is posted to Jira, because Jira is read-only.
  - Recordings are read as still frames, with no audio.
  - Without an authenticated `gh`, you open each PR from its compare link.
  - PASS means "ready for human review", not "guaranteed safe".
- **Maintainers testing unmerged changes:** disable the installed copy (`claude plugin disable engineering-harness@sis-harness`), then run `claude --plugin-dir <your clone>`. Every harness PR must raise `version` in `.claude-plugin/plugin.json`.
- **Layout:** `agents/` holds the Planner, Implementor and Evaluator, `commands/` holds `/work` and `/brain`, and `skills/` holds the ground rules, standards, brain spec, git workflow, attachments and input packets. `hooks/` holds the guards and telemetry, and `templates/` holds the artifact templates.
