# Claude Code Engineering Harness

A minimalist, reusable **Claude Code plugin** for enterprise **bug-fix engineering** on an existing Spring Boot + Angular + PostgreSQL product. Work starts from a Jira ticket and ends at a PR that a **human** reviews and merges.

```
/work ABC-123

Jira → Analyzer → Analysis → Designer → Design → Implementor → Code+Tests
     → Verification → Evaluator ── PASS ────→ PR → Human Review → Human Merge
                                 └─ FAIL/INSUFFICIENT_EVIDENCE → bounded iteration (max 3) → escalate to human
```

## Installation

Clone/copy this directory and load it as a plugin:

```bash
# from a local directory
claude --plugin-dir /path/to/claude_harness_lite

# or as a project-scope plugin: copy into the target repo under .claude/plugins/
# or add a marketplace entry pointing at this repository
```

Then configure a **read-only Jira MCP server** in the target project (see `mcp/jira/README.md`). The plugin bundles no MCP server and no credentials.

## Architecture

Four agents with strictly separated responsibilities; commands orchestrate them; skills provide reusable knowledge; one hook enforces Git safety; runtime state lives in `.runtime/` and is never committed.

```
.claude-plugin/plugin.json     plugin manifest
agents/                        analyzer, designer, implementor, evaluator
commands/                      /work /analyze /design /implement /evaluate /pr
skills/                        architecture, springboot, angular, postgresql, testing,
                               engineering-standards, repository-analysis,
                               characterization-testing, git-workflow
hooks/                         PreToolUse git-guard (protected branches, destructive ops, gh allowlist)
                               and jira-guard (read-only Atlassian MCP tools)
mcp/jira/README.md             read-only Jira MCP integration point
templates/                     analysis, design, implementation-report, evaluation,
                               escalation-report
CLAUDE.md                      high-level ground rules loaded into context
.runtime/<ticket-id>/          temporary artifacts + state.json (gitignored, never committed)
```

Model allocation: Analyzer/Designer/Evaluator run on the strongest available reasoning model; Implementor runs on a faster/cheaper model. Independence of the Evaluator from the Implementor is the important invariant.

## Commands

| Command | Purpose |
|---|---|
| `/work <ticket-id-or-url>` | Full workflow: Jira → analyze → design → implement → evaluate loop (max 3 iterations) → PR → publish summary to Jira where supported |
| `/analyze <ticket>` | Analyzer only; stops before design |
| `/design [ticket]` | Designer only; requires an analysis artifact |
| `/implement [ticket]` | Implementor only; requires analysis + design |
| `/evaluate [ticket]` | Evaluator only; verdict PASS / FAIL / INSUFFICIENT_EVIDENCE |
| `/pr [ticket]` | PR creation, gated on evaluator PASS; without `gh`, pushes the branch and gives a prefilled GitHub compare link + description for the human to open the PR; **never merges** |

### How `/work` runs

`/work` runs the whole flow up to the first PR stage itself. It doesn't call the other commands; it dispatches the same agents directly.

```
/work GSIS-12345
  1. Read the ticket from Jira
  2. Check the repo, propose flow + branch name           ⏸ human confirms
  3. Analyzer → Designer → Implementor → Evaluator  (FAIL → implement + evaluate again, max 3 rounds)
  4. PR stage 1: push branch, give compare link          ⏸ human opens the PR, pastes the URL back
  5. Publish a summary to Jira (blocked while Jira is read-only; artifacts stay in .runtime/)
```

It stops and waits for the human when:
- The flow and branch name need confirmation. Nothing is created before that.
- The working tree has uncommitted changes, or Jira can't be read.
- The Analyzer or Designer returns `NEEDS_INPUT`.
- 3 evaluation rounds fail. An escalation report is written.
- A step needs permission, e.g. running tests, committing or pushing in the default permission mode.

Run manually:
- **`/pr <ticket>` for stage 2.** Once the ticket is deployed and checked on `base-qa`, this raises the customer sandbox PRs. `/work` stops after stage 1, because days can pass between stages.
- **The single-stage commands (`/analyze`, `/design`, `/implement`, `/evaluate`), only when wanted.** Use them to re-run one stage (e.g. `/evaluate` after a manual fix) or to review each artifact before moving on.

Re-running `/work <ticket>` after an interruption resumes from the status in `.runtime/<ticket>/state.json`.

## Agents

- **Analyzer** — understands the ticket against the actual codebase; produces a root-cause analysis with evidence. Read-only.
- **Designer** — independently verifies the analysis; produces the implementation plan, the **regression surface**, and a **risk-based test strategy**. Read-only.
- **Implementor** — implements the design, applies **characterization testing** in low-coverage areas, adds the regression test, runs risk-proportionate verification, records **actual evidence** (commands + real results).
- **Evaluator** — independent quality gate over the whole work product; read-only; issues exactly one verdict (`PASS`, `FAIL`, `INSUFFICIENT_EVIDENCE`); only blocking findings trigger another iteration.

## Runtime artifacts & Jira

`.runtime/<ticket-id>/` holds `state.json`, `analysis.md`, `design.md`, `implementation-report.md`, `evaluation.md` (and `escalation-report.md` on escalation). It is temporary agent-to-agent state, gitignored, never committed, and never contains chain-of-thought. At the end of a run, concise final artifacts are published to the Jira ticket **only if** the configured Jira MCP supports writes; otherwise the limitation is documented and artifacts stay local. Jira is the persistent system of record; Git contains only the product change.

## Git safety

The `git-guard` PreToolUse hook blocks destructive operations (force-push, `reset --hard`, `clean -f`, …) and git commit/push/merge on protected branches, for both the Bash and PowerShell tools. It also restricts the GitHub CLI to reads plus `gh pr create` — merging, approving, commenting, editing PRs, triggering workflows, and write `gh api` calls are denied, because `gh` runs with the human's full GitHub permissions. The branching strategy — flows, branch naming, PR targets, and the protected-branch list the hook reads — is defined only in `skills/git-workflow/SKILL.md` (source PDF under `references/`). To change the strategy, edit that file. The harness never merges, never approves its own PR, never bypasses checks.

A second hook, `jira-guard`, keeps Jira read-only. On Atlassian/Jira MCP servers it allows only the read tools in its allowlist and denies everything else (see `mcp/jira/README.md`).

## Evaluator loop

`MAX_ITERATIONS = 3`. Only evaluator **blocking findings** start a new Implementor→Evaluate cycle; recommendations do not. `INSUFFICIENT_EVIDENCE` first attempts to obtain the missing evidence. After three failed iterations the harness stops and writes an escalation report for the human.

## Limitations (by design)

- Read-only Jira: publishing to Jira requires a user-configured MCP with write support; nothing is faked.
- Automatic PR creation requires an authenticated `gh`; otherwise the human opens each PR from a prefilled compare link.
- No orchestration server, no database, no UI — the loop runs inside Claude Code.
- PASS means "sufficient evidence for human review", not "guaranteed safe".

## Extending

- Add project skills under `skills/<name>/SKILL.md`.
- Add MCP integrations per `mcp/jira/README.md` (Jira write, Git provider, CI/CD).
- Adjust protected branches in `skills/git-workflow/SKILL.md`; destructive patterns in `hooks/scripts/git-guard.js`.
- Tune agent models/effort in `agents/*.md` frontmatter.
