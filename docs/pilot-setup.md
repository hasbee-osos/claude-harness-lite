# Engineering Harness — Pilot Setup

A short guide to running the harness on a few real tickets. The goal is to judge whether it is worth investing in, not to use it for everything yet.

## Pilot scope (read first)

- **One repo per session.** Start Claude **inside the one repo** the ticket changes (a single service or the UI). Multi-repo tickets are not supported yet.
- **Do not start Claude in the parent folder** that holds all the clones. The git safety guard checks the branch of the folder Claude was started in, so from the parent folder it protects nothing.
- **Good pilot tickets:** small, reproducible Bugs (or small Stories) with clear acceptance criteria, on the `base`, `gcet` or `gutech` line.
- **Avoid:** tickets spanning several repos, hotfixes, OSOS, otc/cbfs, and anything urgent.

## Prerequisites

- Claude Code installed and logged in.
- `git` and **Node.js on PATH**. The safety hook runs on Node, and without it the hook silently does nothing.
- The repo's own build tools: JDK + Maven/Gradle for services, Node/npm for the Angular UI. The harness runs real tests.
- A Jira account on `gearsjira.atlassian.net`.

## 1. Get the plugin

Copy the `claude_harness_lite` folder to your machine, e.g. `C:\tools\claude_harness_lite`.

## 2. Connect Jira (once)

```powershell
claude mcp add --transport http --scope user atlassian https://mcp.atlassian.com/v2/mcp
```

Start `claude`, run `/mcp`, select `atlassian`, and complete the browser login, choosing the **gearsjira** site. If the connection is refused, an Atlassian admin must allow the Rovo MCP Server.

> **Jira is read-only in harness sessions.** The plugin's `jira-guard` hook blocks every Atlassian tool except a small list of read tools. It only works while the plugin is loaded, so don't use the Atlassian tools in Claude sessions started without `--plugin-dir`. As a second safety net, decline any prompt to create, edit, comment on or transition an issue, and never choose "always allow" for atlassian tools.
>
> **Jira smoke test:** ask Claude to *add a comment "test" to <a pilot ticket>*. It must be **blocked by engineering-harness jira-guard**. Then ask it to read the ticket; that must work. If a read is blocked, send the blocked tool name so it can be added to the allowlist.

## 3. Prepare the repo

```powershell
cd C:\path\to\sis-product-sis-admin-backend     # the repo the ticket changes
git status                                      # must be clean
git fetch origin
Add-Content .git\info\exclude ".runtime/"       # keep harness state out of git, without touching .gitignore
```

## 4. Start Claude with the plugin

```powershell
claude --plugin-dir "C:\tools\claude_harness_lite"
```

- Keep the default permission mode, so you approve each command. Do not use bypass/auto-accept modes during the pilot.
- If `/work` is not recognized, use `/engineering-harness:work`. The same applies to the other commands.

**Smoke test the guard** before the first ticket. While on a protected branch (e.g. `base-sandbox-qa`), ask Claude to run `git commit --allow-empty -m guard-test`. It must be **blocked by engineering-harness git-guard**. If the commit goes through, stop: check that Node is on PATH and the plugin loaded. If a test commit was created, undo it with `git reset --soft HEAD~1`.

## 5. Run a ticket

```text
/work GSIS-12345
```

What to expect:

1. Claude reads the ticket from Jira.
2. It **proposes a flow and a branch name**, e.g. `base/bugfix/GSIS-12345-short-desc` cut from `base-development`. Check both carefully before confirming.
3. It runs Analyzer → Designer → Implementor → Evaluator. It stops and asks when something is unclear, and after 3 failed evaluation rounds it writes an escalation report.
4. On evaluator PASS, `/pr` pushes the branch and gives you a **GitHub compare link** plus a PR description in `.runtime/<ticket>/pr-<target>.md`. **You** open the PR and paste the PR URL back to Claude.
5. **Stage 2** (customer sandboxes): after the ticket is deployed and checked on `base-qa`, run `/pr GSIS-12345` again. It raises only the next stage's PRs.

You don't need to run the other commands: `/work` goes all the way to the stage 1 PR, pausing only for your input. If it gets interrupted, run `/work GSIS-12345` again and it resumes. The full list of pause points is under "How `/work` runs" in the README.

Claude never merges, approves, force-pushes, raises `base-development` PRs, or does hotfixes. Those stay with you.

**Tip for the first ticket:** run `/analyze GSIS-12345` alone and check the root cause before a full `/work` run.

Individual stages, useful when re-running one step:

| Command | Does |
|---|---|
| `/analyze <ticket>` | Root-cause analysis only |
| `/design [ticket]` | Implementation plan + test strategy (needs analysis) |
| `/implement [ticket]` | Code + tests + verification (needs design) |
| `/evaluate [ticket]` | Independent verdict: PASS / FAIL / INSUFFICIENT_EVIDENCE |
| `/pr [ticket]` | PR links for the current stage (needs PASS) |

All run state is in `.runtime/<ticket>/` inside the repo: `state.json`, `analysis.md`, `design.md`, `implementation-report.md`, `evaluation.md`.

## 6. Feedback to capture per ticket

Before deleting anything, copy `.runtime/<ticket>/` somewhere safe and fill in:

| Question | Answer |
|---|---|
| Ticket / repo / type | |
| Correct flow and branch proposed? | |
| Root cause right? (analysis) | |
| Plan sensible and minimal? (design) | |
| Code quality — would you have merged it as-is? | |
| Tests meaningful and actually run? | |
| Evaluator verdict right? Any false PASS/FAIL? | |
| Iterations used / escalated? | |
| Times you had to step in, and why | |
| Time taken vs. doing it manually | |
| Anything unsafe it tried (blocked or not) | |
| Worth it? (1–5) + one-line reason | |

## Known pilot limitations

- Single repo per session (multi-repo support is planned).
- Jira is read-only: the end-of-run summary is not posted to Jira. Artifacts stay in `.runtime/<ticket>/`.
- No automatic PR creation — compare links only.
- The branching rules come from `skills/git-workflow/SKILL.md`. If Claude's proposal disagrees with how the team works, say so and note it in the feedback.
