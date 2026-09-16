# Engineering Harness — Pilot Setup

A short guide to running the harness on a few real tickets. The goal is to judge whether it is worth investing in, not to use it for everything yet.

## Pilot scope (read first)

- **Start Claude in the workspace folder** that holds all the repo clones. The harness works out which repos a ticket touches (a service, several services, the UI), asks you to confirm, and then changes, tests and raises PRs in each.
- **Good pilot tickets:** small, reproducible Bugs (or small Stories) with clear acceptance criteria, on the `base`, `gcet` or `gutech` line. Include at least one that touches a service **and** the UI.
- **Avoid:** hotfixes, OSOS, otc/cbfs, and anything urgent.

## Prerequisites

- Claude Code installed and logged in.
- `git` and **Node.js on PATH**. The safety hooks run on Node, and without it they silently do nothing.
- The repos' own build tools: JDK + Maven/Gradle for services, Node/npm for the Angular UI. The harness runs real tests.
- A Jira account on `gearsjira.atlassian.net`.

## 1. Workspace folder

Put the plugin and all product repos side by side in one folder:

```text
C:\sis-workspace\                          # workspace folder (any path)
├── claude_harness_lite\                   # the plugin — copy it here
├── sis-product-sis-admin-backend\         # product repos, cloned as usual
├── sis-product-sis-frontend\
└── …the other services…
```

- The plugin repo has no GitHub remote yet, so **copy** the `claude_harness_lite` folder in instead of cloning it.
- Clone **all** product repos, so the harness can follow a flow from the UI through every service.
- Make sure repos have **no uncommitted work** you care about. The harness never touches uncommitted changes; it stops and asks if a repo it needs to change is dirty.
- The harness keeps its state in `C:\sis-workspace\.runtime\`, outside every repo, so nothing needs to be gitignored.

## 2. Connect Jira (once)

Run this from **any directory**. With `--scope user` it applies to every folder you start Claude in.

```powershell
claude mcp add --transport http --scope user atlassian https://mcp.atlassian.com/v2/mcp
```

Start `claude`, run `/mcp`, select `atlassian`, and complete the browser login, choosing the **gearsjira** site. If the connection is refused, an Atlassian admin must allow the Rovo MCP Server.

> **Jira is read-only in harness sessions.** The plugin's `jira-guard` hook blocks every Atlassian tool except a small list of read tools. It only works while the plugin is loaded, so don't use the Atlassian tools in Claude sessions started without `--plugin-dir`. As a second safety net, decline any prompt to create, edit, comment on or transition an issue, and never choose "always allow" for atlassian tools.

## 3. Start Claude in the workspace

```powershell
cd C:\sis-workspace
claude --plugin-dir "C:\sis-workspace\claude_harness_lite"
```

- Keep the default permission mode, so you approve each command. Do not use bypass/auto-accept modes during the pilot.
- If `/work` is not recognized, use `/engineering-harness:work`. The same applies to the other commands.

## 4. Smoke tests (before the first ticket)

1. **Git guard.** Pick a repo that is on a protected branch (e.g. `base-sandbox-qa`) and ask Claude to run `git -C <that-repo-folder> commit --allow-empty -m guard-test`. It must be **blocked by engineering-harness git-guard**. If the commit goes through, stop: check that Node is on PATH and the plugin loaded. Undo the test commit with `git -C <repo> reset --soft HEAD~1`.
2. **Jira guard.** Ask Claude to *add a comment "test" to <a pilot ticket>*. It must be **blocked by engineering-harness jira-guard**. Then ask it to read the ticket; that must work. If a read is blocked, send the blocked tool name so it can be added to the allowlist.

## 5. Run a ticket

```text
/work GSIS-12345
```

What to expect:

1. Claude reads the ticket from Jira.
2. It **proposes a flow and a branch name**, e.g. `base/bugfix/GSIS-12345-short-desc` cut from `base-development`. Check both before confirming.
3. It fetches all repos, then the Analyzer traces the problem across repos and the Designer plans the change per repo.
4. It shows **which repos it wants to change** (and which it only read). Check the list before confirming — nothing is created before this.
5. It creates the ticket branch in each confirmed repo, implements, runs each repo's tests, and has the Evaluator check every repo plus the consistency between them. After 3 failed evaluation rounds it writes an escalation report.
6. On PASS, it pushes each branch and gives you **one GitHub compare link per repo**, with PR descriptions in `.runtime\GSIS-12345\pr-<repo>-<target>.md`. **You** open the PRs and paste the URLs back.
7. **Stage 2** (customer sandboxes): after the ticket is deployed and checked on `base-qa` in every changed repo, run `/pr GSIS-12345` again.

You don't need to run the other commands: `/work` goes all the way to the stage 1 PRs, pausing only for your input. If it gets interrupted, run `/work GSIS-12345` again and it resumes. The full list of pause points is under "How `/work` runs" in the README.

Claude never merges, approves, force-pushes, pushes to protected branches, raises `base-development` PRs, or does hotfixes. Those stay with you.

**Tip for the first ticket:** run `/analyze GSIS-12345` alone and check the root cause and repo list before a full `/work` run.

Individual stages, useful when re-running one step:

| Command | Does |
|---|---|
| `/analyze <ticket>` | Root-cause analysis + which repos are involved |
| `/design [ticket]` | Plan per repo + test strategy (needs analysis) |
| `/implement [ticket]` | Code + tests + verification in each confirmed repo (needs design) |
| `/evaluate [ticket]` | Independent verdict per repo and overall: PASS / FAIL / INSUFFICIENT_EVIDENCE |
| `/pr [ticket]` | PR links per repo for the current stage (needs PASS) |

All run state is in `C:\sis-workspace\.runtime\<ticket>\`: `state.json`, `analysis.md`, `design.md`, `implementation-report.md`, `evaluation.md`.

## 6. Feedback to capture per ticket

Before deleting anything, copy `.runtime\<ticket>\` somewhere safe and fill in:

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

## Known pilot limitations

- Jira is read-only: the end-of-run summary is not posted to Jira. Artifacts stay in `.runtime\<ticket>\`.
- No automatic PR creation — compare links only.
- Multi-repo support is new and untested on real tickets; the repo-selection and cross-repo checks are exactly what the pilot should judge.
- The branching rules come from `skills/git-workflow/SKILL.md`. If Claude's proposal disagrees with how the team works, say so and note it in the feedback.
- The development guidelines the agents follow (database, Liquibase, base classes, authorization, common components, error handling, dates) live in `skills/engineering-standards/references/sis-development-guidelines.md`. If a rule there is wrong, outdated or missing, that's a finding worth reporting — see `docs/maintaining-guidelines.md`.
