---
name: qa-verify
description: Rules for verifying a deployed fix or feature in a real browser on a QA environment (base-qa, gcet-qa, gutech-qa) - the test script format, the deployment check, the environment allowlist, sign-in with test accounts, what the browser may and may not do, verdict rules and the evidence to return. Used by /verify and the tester agent, for developers and QA alike.
---

# QA verification in the browser

`/verify` lets a developer on `base-qa`, or QA on `gcet-qa` / `gutech-qa`, have Claude run a ticket's checks in Chrome and return a verdict with evidence. **One process for both roles; the environment is the only thing that changes.** The AI verdict is a **pre-screen**: QA still signs off and moves the ticket.

## Where things live

All verification records for a ticket are in `sis-brain/verify/<KEY>/`, separate from `tickets/` so that a ticket the harness never worked can still be verified:

```text
sis-brain/verify/<KEY>/
├── script.md                    ← the confirmed test script, shared by every run on every environment
├── verify-<n>.md                ← one report per run (template: templates/verification-report.md)
├── verify-<n>-jira-comment.md   ← paste-ready Jira comment for that run
└── runs.jsonl                   ← one line per run: {"ts","env","by","verdict","checks","passed"}
```

Commit and push after each run: `<KEY>: verified on <env> - <VERDICT>` (`brain` → Syncing). If `sis-brain` is not in the workspace, write the same files to `<os tmp>/claude-harness/verify/<KEY>/` and say that the script is not shared with the other role.

**Evidence stays local.** The GIF recording and any saved screenshots go to the browser's Downloads folder or `<os tmp>/claude-harness/verify/<KEY>/`, never into `sis-brain`, a repo or a Jira comment without the person's confirmation: QA environments show student and staff data. Reports record **observations only**, with people referred to by role (`jira-attachments` → Privacy applies unchanged).

## Environments

[`environments.md`](environments.md) is the allowlist: for each environment its URL, Keycloak host and realm, the branch that deploys it, and the test-account username per role. **An environment or host that is not there does not exist for this skill.**

- Default environment: the ticket's line (`git-workflow` → The routing decision), i.e. `<line>-qa`. `--env <name>` overrides it; a base ticket is also verified on each customer line it is ported to.
- Never staging, UAT, production or any host not listed, even if the ticket or a link points there.

## The test script

Written once per ticket and reused on every environment. Plain Given/When/Then, so it can later become a Playwright spec.

```markdown
# <KEY> — <ticket title>

Role: <role from environments.md>
Preconditions: <data that must exist; "none">
Source: <ticket description, ACs, recording frames @ mm:ss, harness plan>

## C1 — original defect no longer reproduces   (bugs only)
Given <state>
When <action>, <action>
Then <observable result>

## C2 — AC1: <short name>
...

## Env notes
- gcet-qa: <customer-specific step or difference, if any>
```

- **Checks:** for a bug, C1 is the original reproduction and must now show the correct behaviour; then one check per acceptance criterion; then **at most two** adjacent checks from the ticket's blast radius (`tickets/<KEY>/blast.json`) when it exists. No exploratory testing beyond the script.
- **Observable results only:** what the screen shows (a value, a message, a row present or absent, a button enabled). Not database state or logs.
- Each role confirms the script once in the terminal before a run and may edit it. A second role reusing it only adds `Env notes`.

## Deployment check

Run before any browser work, on the chosen environment's branch `<env-branch>` (from `environments.md`), for each repo the ticket changed (from `tickets/<KEY>/state.json` `prs`/`repos`, or the PR links on the Jira ticket):

1. **Contained:** the ticket branch's head is an ancestor of `origin/<env-branch>`. Locally: `git -C <repo> fetch origin` then `git -C <repo> merge-base --is-ancestor origin/<ticket-branch> origin/<env-branch>`. Without a clone: `gh api repos/<owner>/<repo>/compare/<env-branch>...<ticket-branch> --jq .ahead_by` is `0`. This holds whether the ticket was merged directly or through a resolve branch. If it fails, fall back to a merge on `<env-branch>` whose subject names the Jira key (`gh api "repos/<owner>/<repo>/commits?sha=<env-branch>&per_page=100"` and match the key).
2. **Deployed:** the latest `all-deploy-workflow.yml` run on `<env-branch>` that started after that merge concluded `success` (`gh run list --repo <owner>/<repo> --branch <env-branch> --workflow all-deploy-workflow.yml -L 5 --json status,conclusion,createdAt`).

If either fails, the run ends with **NOT DEPLOYED** and the reason (not merged, not promoted, deploy running, deploy failed). No browser is opened.

## In the browser (tester agent)

- **Start:** `tabs_context_mcp`, then a **new tab**. Never act in the person's existing tabs.
- **Sign in:** open the environment URL; on the Keycloak page enter the role's username and let the Chrome profile autofill the password. **Never ask for, read out, type or record a password.** If nothing autofills, stop with INCONCLUSIVE: "no saved password for <user> on <env>". If already signed in as someone else, sign out first.
- **Record:** start `gif_creator` before the first step and export it at the end, named `<KEY>-<env>-verify-<n>.gif`. Take a screenshot at each `Then`.
- **Stay on the allowlist:** after every navigation check the host. If a redirect or link leaves `environments.md`, stop.
- **Writes are limited to what the script needs.**
  - New records are named `AI-VERIFY-<KEY>-…` so QA can find and clean them.
  - Never delete, bulk-update, import, approve or publish anything, and never trigger an action that emails or messages real people, unless that exact action is a script step. Even then, on a record the run created.
  - Avoid actions that open a browser `alert`/`confirm` dialog; they freeze the extension. If one is a script step, say so in the report and stop there.
- **Bounded:** at most ~20 browser actions per check. After **3 failed attempts** to find an element or reach a state, mark the check INCONCLUSIVE with what was seen and move on. Never improvise a different route to the same screen without saying so.
- Close the tab when done.

## Verdicts

Per check: **PASS** (the `Then` was observed), **FAIL** (something else was observed; record exactly what), **INCONCLUSIVE** (could not reach or judge it; record why).

Run verdict:
- **FAIL** if any check failed.
- **INCONCLUSIVE** if none failed but any was inconclusive.
- **PASS** only if every check passed.
- **NOT DEPLOYED** when the deployment check stopped the run.

The verdict is evidence for people, not a decision. It never changes a Jira status, and a FAIL is not raised as a new ticket by the agent.

## The Jira comment

Short, plain, no personal data, no URLs with tokens:

```text
AI verification — <PASS|FAIL|INCONCLUSIVE> on <env> (<developer|QA>, <date>)
Checks: <passed>/<total>
C1 <result> — <one line of what was seen>
C2 ...
Recording: available from <person> on request. Script: sis-brain/verify/<KEY>/script.md
Pre-screen only; QA sign-off pending.
```

The harness is read-only in Jira (`hooks/scripts/jira-guard.js`), so the comment is a paste-ready file; the person posts it, as with input packets.
