---
name: git-workflow
description: Where to cut a ticket branch from and which branch to raise its PR against, decided by the Jira Customer Name field (Product Core Feature / GCET / GUTech), plus branch naming, merge conflicts (dry-run check, resolve branches, mechanical vs semantic resolution, equivalence proof), protected branches and Git safety rules - no force-push, no auto-merge, no commits on protected branches. Use for all Git operations, branch creation, conflict resolution and PR preparation.
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

Over a third of ticket PRs into a sandbox conflict, because others merge into the same branch all day (`references/branching-analysis.md` §4). All of it runs through `scripts/conflicts.js` in this skill's directory — `node "<this skill's base directory>/scripts/conflicts.js" …` — which is read-only and prints JSON:

| Command | Does |
|---|---|
| `conflicts.js check <repo> origin/<target> <head>` | Dry-run merge (`git merge-tree`): clean, or each conflicted file with its hunks, both sides and the enclosing method or block. Touches nothing. |
| `conflicts.js name <repo> <ticket-branch> origin/<target>` | The resolve-branch name, and any that already exist for that target |
| `conflicts.js compare <repo> origin/<target> <ticket-branch> <resolve-branch> --record <file>` | Equivalence: the resolve branch carries exactly the ticket's change, apart from recorded resolutions. Returns `pass`, the failed checks and a Markdown table. |

### When to check

`fetch`, then `check` every changed repo against `origin/<pr_target>`: **before the Evaluator runs** (so it reviews any resolution), again **just before raising the PR** (the target moves), and again when a ticket **comes back after hand-off**. `<head>` is the resolve branch when one exists for that target, otherwise the ticket branch.

### The resolve branch

- **Only when `check` reports conflicts for that target.** A clean target gets its PR from the ticket branch. One resolve branch per ticket and target.
- **Never merge a long-lived branch into the ticket branch** — the target, `base-development` or any protected branch. The ticket branch stays exactly what was implemented and evaluated, because its other PRs must carry only the ticket. `git-guard` blocks such a merge (or `pull`) on anything but a resolve branch.
- **Name** — use what `name` returns, never a hand-typed variant: `<ticket-branch>-<target>-conflict-resolved`, e.g. `base/bugfix/GSIS-28533-coa-duplicate-scoped-by-university-base-sandbox-qa-conflict-resolved`. It keeps the line prefix CI validates and names the target.
- **Construction** — cut it from the ticket branch and merge the target in:
  `git -C <repo> switch -c <resolve-branch> <ticket-branch>`, then `git -C <repo> merge --no-ff origin/<target>`.
  **Never cherry-pick or re-apply the ticket's commits by hand** onto a fresh branch: history no longer links the PR to the evaluated commits, and any hand-copied change is a new, unreviewed edit.
- **Reuse** it while its PR is open. When the target moves, merge `origin/<target>` into it again. When the ticket branch gets a fix, the fix goes on the ticket branch and the ticket branch is merged into the resolve branch; then push the resolve branch, because that is what the PR shows. Never commit fixes only on the resolve branch — the ticket's other PRs would miss them. If a resolve PR has already merged and a later change conflicts again, `name` gives the next one (`…-conflict-resolved-2`).
- Never rebase or force-push it; never blanket `--ours`/`--theirs`.

### Resolving

Classify **each hunk**, not each file:

| Mechanical — resolve it | Semantic — the developer decides |
|---|---|
| Both sides add distinct entries at the same place: imports, i18n keys, enum or constant entries, route or module registrations, list items | Both sides modify the same existing lines of a method, query, SQL statement or template |
| Both sides append Liquibase changesets or changelog `include`s — keep both; never edit, reorder or renumber an existing changeset | One side deletes or moves code the other modifies |
| Formatting or whitespace only | The merged code compiles, but the combined behaviour is not plainly what both tickets meant |
| Generated or lock files — regenerate them | Anything that needs a business rule |

For a semantic hunk, do not resolve it. Return what this ticket intended (from the plan), what the other side intended (the commit and Jira key that introduced it: `git -C <repo> log origin/<target> -L<start>,<end>:<file>`), a proposed resolution and its risk. The developer confirms or corrects it in the terminal — it is not a QA or SME packet — and the confirmed resolution is recorded as a decision citing both Jira keys.

After resolving: run the verification the plan names for the affected code on the resolve branch, commit the merge, write the **record** — `conflict-resolution-<repo>-<target>.json` in the ticket folder:

```json
{ "resolved":  [{ "file": "src/.../FeeService.java", "class": "mechanical", "rationale": "both sides added an import" }],
  "justified": [{ "file": "src/.../FeeService.java", "line": "import t.Helper;", "reason": "the target already imports t.*" }] }
```

`resolved` lists every file whose merged content goes beyond either side (including a post-merge fix in a file that did not conflict); `justified` lists any ticket line deliberately not carried over. Then run `compare --record` and put its Markdown table in the implementation report's **Conflict resolution** section.

### Equivalence

`compare` fails if the resolve branch does not contain the ticket branch's head, touches a file the ticket does not (unless recorded), loses a line the ticket adds or removes (unless justified), adds anything beyond the ticket that is not a recorded resolution, or still has conflict markers. A failure is fixed before the PR is raised, never waved through; the Evaluator treats one as blocking.

### In the PR

Raise it from the resolve branch; say in the description which ticket branch it resolves, and include the `compare` table. Record the resolve branch against its repo in `state.json`.

## Safety rules

- Before modifying files, confirm the working tree is clean of unrelated changes. Never overwrite, stash, or discard user changes without their direction.
- Commit discipline: small, focused, Jira-key-referencing commits; no secrets; no unrelated files.
- Inspect the final diff of each changed repo (`git -C <repo> diff`, `git -C <repo> diff --staged`) before finishing; ensure the change is scoped to the ticket.
- **Never**: force-push, auto-merge, bypass CI/checks, approve your own PR, rewrite history on shared branches, commit to protected branches.
- Destructive operations (`reset --hard`, `clean -f`, `branch -D`, `push --force`) require explicit human authorization.
