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
hooks/                         PreToolUse git-guard (protected branches, destructive ops)
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
| `/pr [ticket]` | PR creation, gated on evaluator PASS; generates PR text if no Git provider integration; **never merges** |

## Agents

- **Analyzer** — understands the ticket against the actual codebase; produces a root-cause analysis with evidence. Read-only.
- **Designer** — independently verifies the analysis; produces the implementation plan, the **regression surface**, and a **risk-based test strategy**. Read-only.
- **Implementor** — implements the design, applies **characterization testing** in low-coverage areas, adds the regression test, runs risk-proportionate verification, records **actual evidence** (commands + real results).
- **Evaluator** — independent quality gate over the whole work product; read-only; issues exactly one verdict (`PASS`, `FAIL`, `INSUFFICIENT_EVIDENCE`); only blocking findings trigger another iteration.

## Runtime artifacts & Jira

`.runtime/<ticket-id>/` holds `state.json`, `analysis.md`, `design.md`, `implementation-report.md`, `evaluation.md` (and `escalation-report.md` on escalation). It is temporary agent-to-agent state, gitignored, never committed, and never contains chain-of-thought. At the end of a run, concise final artifacts are published to the Jira ticket **only if** the configured Jira MCP supports writes; otherwise the limitation is documented and artifacts stay local. Jira is the persistent system of record; Git contains only the product change.

## Git safety

The `git-guard` PreToolUse hook blocks destructive operations (force-push, `reset --hard`, `clean -f`, …) and git commit/push/merge on protected branches (`main`, `master`, `develop`, `development`, `release/*`). Branch model: `feature/<ticket-id>` → PR → human merge. The harness never merges, never approves its own PR, never bypasses checks.

## Evaluator loop

`MAX_ITERATIONS = 3`. Only evaluator **blocking findings** start a new Implementor→Evaluate cycle; recommendations do not. `INSUFFICIENT_EVIDENCE` first attempts to obtain the missing evidence. After three failed iterations the harness stops and writes an escalation report for the human.

## Limitations (by design)

- Read-only Jira: publishing to Jira requires a user-configured MCP with write support; nothing is faked.
- PR creation requires `gh` (or another provider integration); otherwise PR text is generated for manual use.
- No orchestration server, no database, no UI — the loop runs inside Claude Code.
- PASS means "sufficient evidence for human review", not "guaranteed safe".

## Extending

- Add project skills under `skills/<name>/SKILL.md`.
- Add MCP integrations per `mcp/jira/README.md` (Jira write, Git provider, CI/CD).
- Adjust protected branches / destructive patterns in `hooks/scripts/git-guard.js`.
- Tune agent models/effort in `agents/*.md` frontmatter.
