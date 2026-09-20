---
name: git-workflow
description: Where to cut a ticket branch from and which branch to raise its PR against, decided by the Jira Customer Name field (Product Core Feature / GCET / GUTech), plus branch naming, conflict resolve branches, protected branches and Git safety rules - no force-push, no auto-merge, no commits on protected branches. Use for all Git operations, branch creation, and PR preparation.
---

# Git Workflow

This skill decides two things: **which branch a ticket branch is cut from**, and **which branch its PR targets**. Everything downstream of that PR — promotion to a QA environment, porting onto another customer line, the post-QA merge — is human work and is deliberately not described here.

Evidence for the branch map: [`references/branching-analysis.md`](references/branching-analysis.md) (backend + frontend, 2026-06-20 → 2026-09-20), and `pr-validation.yml` in `pbsgears/sis-product-devops-workflows`, which defines the merge paths CI accepts. The team is migrating to a single trunk; when that lands there is one source branch and one target for everyone, and this skill collapses accordingly.

If this skill and reality disagree, stop and ask the human.

**Inspect the current repository state before acting** (`git -C <repo> status`, `git -C <repo> branch --show-current`, `git -C <repo> fetch`).

## The routing decision

Read the **Customer Name** field on the Jira issue. It decides the line, the source branch and the PR target — the same in every repo the ticket changes.

| Customer Name | Line | Cut the ticket branch from | Raise the PR against |
|---|---|---|---|
| `Product Core Feature` | `base` | **`base-development`** | **`base-sandbox-qa`** |
| `GCET` | `gcet` | **`gcet-sandbox-qa`** | **`gcet-sandbox-qa`** |
| `GUTech` | `gutech` | **`gutech-sandbox-qa`** | **`gutech-sandbox-qa`** |
| empty, or any other value | — | **Stop — do not guess.** | |

Match the value case-insensitively, ignoring surrounding whitespace.

**When Customer Name is empty or unrecognised**, stop before creating any branch and raise an input packet (`input-packets`): `sme-packet.md` for a feature (Story, Task, Improvement), `qa-packet.md` for a bug. OSOS and every other line reach this row on purpose — agents do not work them.

`base` tickets are cut from `base-development`, not from `base-sandbox-qa`, even though the team commonly does the latter: a branch cut from the sandbox carries other people's unverified work into the PR.

## Branch naming

`{line}/{type}/{JIRA-ID}-{short-kebab-description}` — e.g. `base/bugfix/GSIS-23735-course-reg-submit-npe`.

- **Line** from the table above: `base`, `gcet` or `gutech`.
- **Type** from the Jira issue type (`harness-core` → Work types): Story / Task / Improvement → `feature`, Bug → `bugfix`; a Sub-task follows its parent. No other types (`task`, `bug-fix`, `fix`, …).
- Keep the Jira key's case. Description short, lowercase, hyphen-separated.
- The **same branch name in every changed repo**.

## Agent PR scope

One PR per changed repo, from the ticket branch to the target in the table, raised only after the evaluation gate.

Never raise: promotion PRs (`*-sandbox-qa` → `*-qa`), the post-QA merge into `base-development`, a port onto another customer line, hotfix or back-merge PRs. List those as **next human steps** in the PR description. Agents never merge, approve, or bypass checks.

Hotfixes (`{line}/hotfix/*` → `pre-hotfix-*`) are human-only. If the ticket needs one, stop and escalate.

## Protected branches

Never commit, push, merge, or rebase on these. `hooks/scripts/git-guard.js` reads this block directly — one pattern per line; `*` matches any characters except `/`.

```protected-branches
main
master
develop
development
*-development
*-sandbox-qa
*-qa
*-sandbox-staging
*-staging
*-uat
*-finalized
*-master
*-prodtest
*-release-*
*-hotfix-*
pre-hotfix-*
bypass-all-branches-becarefully
```

Never create or use `bypass-all-branches-becarefully` (the CI emergency bypass).

## Merge conflicts

Roughly 40% of PRs into a sandbox conflict, because others merge into the same branch continuously.

- **Never merge the target branch into the ticket branch.** Cut a **resolve branch** from the target instead — `git -C <repo> checkout -b <branch>-<target>-conflict-resolved origin/<target>` — merge the ticket branch into it, resolve, and raise the PR from the resolve branch. The ticket branch stays untouched.
- Keep the ticket branch's line prefix on the resolve branch (`base/…`, `gcet/…`, `gutech/…`); CI validates the source prefix.
- Resolve only **mechanical** conflicts (imports, adjacent edits, generated or lock files). Re-run verification, and record each resolved file with its rationale in the implementation report so the Evaluator reviews it.
- **Semantic** conflicts — both sides changed the same logic, or the resolution needs a business decision — stop and escalate to the human.
- Never blanket `--ours`/`--theirs`; never rebase a pushed branch.
- Record the resolve branch against its repo in `state.json`, and say in the PR description which ticket branch it resolves.

## Safety rules

- Before modifying files, confirm the working tree is clean of unrelated changes. Never overwrite, stash, or discard user changes without their direction.
- Commit discipline: small, focused, Jira-key-referencing commits; no secrets; no unrelated files.
- Inspect the final diff of each changed repo (`git -C <repo> diff`, `git -C <repo> diff --staged`) before finishing; ensure the change is scoped to the ticket.
- **Never**: force-push, auto-merge, bypass CI/checks, approve your own PR, rewrite history on shared branches, commit to protected branches.
- Destructive operations (`reset --hard`, `clean -f`, `branch -D`, `push --force`) require explicit human authorization.
