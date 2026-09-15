---
name: git-workflow
description: Team Git branching and PR strategy (base / gcet / gutech / osos lines) plus Git safety rules - flow selection with human confirmation, source branches, branch naming, dev-stage PR targets, conflict resolution branches, protected branches, commit discipline, no force-push, no auto-merge. Use for all Git operations, branch creation, and PR preparation.
---

# Git Workflow

This skill is the single source of truth for how agents branch, resolve conflicts, and raise PRs. It reflects the team's actual practice as of 2026-09 (repository merge history of the last two months), reconciled with:
- [`references/branching-strategy-2026-03-20.pdf`](references/branching-strategy-2026-03-20.pdf) — the team diagram.
- `pr-validation.yml` in `pbsgears/sis-product-devops-workflows` — the merge paths CI allows.
- [`references/branching-analysis.md`](references/branching-analysis.md) — repository evidence (backend + frontend, 2026-07-15 → 2026-09-15): merge volumes, stage ordering, conflict rates, and the deviations between the diagram, team practice, and this skill.

If this skill and reality disagree, stop and ask the human.

**Inspect the current repository state before acting** (`git status`, `git branch --show-current`, `git fetch`).

## Branch map

Branch names use **hyphens**. Long-lived branches have no `/`; ticket branches always do.

| Kind | Branches | Who merges |
|---|---|---|
| Base trunk | `base-development` — record of QA-verified base tickets; not deployed | Lead developer |
| Base integration → env | `base-sandbox-qa` → `base-qa` (auto-deploys on merge) | Developers |
| Customer integration → env | `gcet-sandbox-qa` → `gcet-qa`, `gutech-sandbox-qa` → `gutech-qa` (auto-deploy on merge) | QA |
| Production | Images built on merge into `*-qa` are promoted to prodtest/prod (and OSOS envs) by commit SHA via the GitOps repos — no branch promotion | DevOps |
| Hotfix staging | `pre-hotfix-<env>-<commit>` cut from the deployed commit | Humans/DevOps |
| Legacy / unused | `*-development` and `*-master` for customer lines, `*-finalized`, `*-staging`, `*-sandbox-staging`, `*-uat`, `*-release-*`, `*-hotfix-release-*`, `main` | — |
| Ticket branches (agent-owned) | `{line}/{type}/<JIRA-ID>-<desc>` and their resolve branches | — |

Never create or use `bypass-all-branches-becarefully` (CI emergency bypass).

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

## Flows

### A. Common (base) ticket — default
The stages are strictly ordered. Never raise a later stage's PR before the previous stage is done.

1. Cut `base/{feature|bugfix}/<JIRA-ID>-<desc>` from **`base-development`**. Never from a sandbox or QA branch: the ticket branch later goes to `base-development` and must carry only this ticket.
2. **Stage 1 — agent raises** PR → `base-sandbox-qa`. Other developers merge into the same sandbox concurrently, so resolve conflicts with a resolve branch (see Merge conflicts). Developers merge it; the sandbox is then promoted → `base-qa`.
3. **Stage 2 — agent raises** PR → `gcet-sandbox-qa` and/or `gutech-sandbox-qa`, only for the customer lines the ticket applies to (about a third of base tickets apply to none), and **only after the human confirms the ticket is deployed on `base-qa` and checked there**. Use a resolve branch per conflicting target. QA merges → `gcet-qa`/`gutech-qa` and verifies.
4. **Stage 3 — human only**: after QA verification on the customer QA env (or on `base-qa` for base-only tickets), PR ticket branch → `base-development`, merged by the lead.

Observed timing (2026-07/09): the customer-sandbox merge follows `base-qa` by under a day, and `base-development` follows the customer QA env by about 4–5 days.

### B. Customer-specific ticket (gcet / gutech)
1. Cut `{gcet|gutech}/{feature|bugfix}/<JIRA-ID>-<desc>` from **`{line}-sandbox-qa`**.
2. **Agent raises** PR → `{line}-sandbox-qa`.
3. Human steps: QA merges → `{line}-qa`, verifies.

### Hotfixes — human only
Observed flow: `{line}/hotfix/<JIRA-ID>-<desc>` → PR into a `pre-hotfix-<env>-<commit>` branch (cut by humans/DevOps from the deployed commit) → image deployed by SHA → humans back-merge `pre-hotfix-*` into `*-sandbox-qa` / `*-development`.
**Agents do not perform hotfixes.** If the ticket needs a hotfix, stop and escalate to the human.

### OSOS
Only hotfix activity exists (`osos/hotfix/*` → `pre-hotfix-osos-*`); there is no `osos-sandbox-qa`/`osos-qa`. Since agents don't do hotfixes, escalate OSOS tickets to the human.

### Dormant lines (otc, cbfs)
Branches exist but there is no recent activity. Do not assume a flow; ask the human.

## Flow selection

- Propose exactly one flow (A or B) from the Jira context with a one-line reason, the full branch name, and the PR targets per stage. Hotfix, OSOS, and dormant-line tickets → escalate.
- **The human must confirm the flow, branch name, and PR targets before any branch is created.** If context is ambiguous, stop and ask.
- Record `flow`, `source_branch`, `branch`, `pr_targets` (grouped by stage, with each stage's status) in `.runtime/<ticket-id>/state.json`.

## Branch naming

Format: `{line}/{type}/{JIRA-ID}-{short-kebab-description}` — e.g. `base/bugfix/GSIS-23735-course-reg-submit-npe`.

| Line | Story / Task | Bug |
|---|---|---|
| Base (common) | `base/feature/…` | `base/bugfix/…` |
| GCET specific | `gcet/feature/…` | `gcet/bugfix/…` |
| GUtech specific | `gutech/feature/…` | `gutech/bugfix/…` |

- **Type** from Jira issue type: Story/Task → `feature`, Bug → `bugfix`. (`hotfix` exists but is human-only.)
- **Line** from the confirmed flow: A → `base`, B → the customer line.
- Keep the Jira key's case; description is short, lowercase, hyphen-separated. No other types (`task`, `bug-fix`, `fix`, …) and no line typos.

## Agent PR scope

Agents raise **dev-stage PRs only**: ticket (or resolve) branch → `base-sandbox-qa` (flow A stage 1 / flow B), and → `gcet-sandbox-qa` / `gutech-sandbox-qa` (flow A stage 2, after the human confirms stage 1 is on `base-qa`). Never raise: the post-QA PR to `base-development`, `*-sandbox-qa` → `*-qa` promotions, hotfix or back-merge PRs. List those as **next human steps** in the PR summary. Agents never merge or approve any PR.

## Merge conflicts

**On agent-owned merges** (e.g. updating a ticket branch from its own source branch):
- Resolve only mechanical conflicts (imports, adjacent edits, generated/lock files). Re-run verification, and record each resolved file with its rationale in the implementation report so the Evaluator reviews it.
- Semantic conflicts (both sides changed the same logic, or resolution needs a business decision): stop and escalate to the human.
- Never blanket `--ours`/`--theirs`, never rebase a pushed branch.

**On PRs to sandbox branches** (the common case — roughly a third of base PRs into sandboxes conflict):
- **Never merge the target branch into the ticket branch.** That drags unverified sandbox work into a branch that later goes to `base-development`.
- Use a **resolve branch**: cut it from the PR target, merge the ticket branch into it, resolve following the agent-owned rules above, and raise that target's PR from the resolve branch. The ticket branch stays unchanged; other targets keep using it.
- Name: `<ticket-branch>-<target-branch>-conflict-resolved` — e.g. `base/bugfix/GSIS-23735-course-reg-submit-npe-gcet-sandbox-qa-conflict-resolved`. Keep the ticket branch's `base/…` prefix (CI validation allows `base/*/*` into customer sandboxes).
- Record each resolve branch against its target in `state.json`, and state in the PR description which ticket branch it resolves.

## Safety rules

- Before modifying files, confirm the working tree is clean of unrelated changes. Never overwrite, stash, or discard user changes without their direction.
- Commit discipline: small, focused, Jira-key-referencing commits; no secrets; no unrelated files.
- Inspect the final diff (`git diff`, `git diff --staged`) before finishing; ensure the change is scoped to the ticket.
- **Never**: force-push, auto-merge, bypass CI/checks, approve your own PR, rewrite history on shared branches, commit to protected branches.
- Destructive operations (`reset --hard`, `clean -f`, `branch -D`, `push --force`) require explicit human authorization.
