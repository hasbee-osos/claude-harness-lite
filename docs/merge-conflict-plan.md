# Merge conflicts: prevent, detect, resolve, prove

## Context

Merge conflicts are the team's most frequent PR chore. The branching analysis (`skills/git-workflow/references/branching-analysis.md` §4, §11) measures it:

- **44%** of ticket PRs into `base-sandbox-qa` need a resolve branch, and **24%** into `base-development`. Conflict load on every sandbox is rising by 3–6 points per window.
- **35–36%** of all developer-facing merges port the same change onto another customer line, and each port is resolved again by hand.
- **Nothing checks a resolve branch against the ticket.** A resolution that drops or duplicates part of the change reaches QA unnoticed.

### How the team resolves conflicts today

Every ticket PR merged into `base-`, `gcet-` and `gutech-sandbox-qa` in admin-backend and frontend, 2026-06-20 → 2026-09-24 (2,023 PRs, classified from the merge commits inside each PR):

| How the PR reached its target | PRs | Share |
|---|---|---|
| Clean: no merge commits inside the PR | 1,072 | 53% |
| Through a **resolve branch** | 736 | 36% |
| **Target or `base-development` merged straight into the ticket branch** | 170 | 8% |
| Another ticket's branch merged in (dependent work) | 38 | 2% |
| Other merges | 7 | <1% |

About four in five conflicts are resolved on a separate branch and one in five in place. Resolving in place is the harmful case. A base ticket branch is raised as a PR to as many as four targets (`base-sandbox-qa`, `gcet-sandbox-qa`, `gutech-sandbox-qa`, `base-development`). Once `base-sandbox-qa` has been merged into it, the later customer-line PRs carry other tickets' unverified work onto those lines.

How the 736 resolve branches were built:

| Construction | Share |
|---|---|
| Cut from the ticket branch, target merged into it | 54% |
| Cut from the target, ticket commits re-applied by cherry-pick or by hand (reworded commits, no merge) | 37% |
| Cut from the target, ticket branch merged into it | 5% |
| Other | 4% |

The first and third constructions produce the same code, because a merge's result does not depend on which side it starts from. The second has no link in history back to the ticket's commits, so nothing shows whether all of the change arrived.

Resolve-branch names vary widely. Only 30 of the 227 resolve branches merged in the last 30 days use `<ticket-branch>-<target>-conflict-resolved` (28% over three months, per the branching analysis). The rest use `-conflict`, `-resolve`, `-base-resolve`, the target placed before the suffix, or a `gcet/base/feature/…` double prefix.

The structural fix is the single trunk (`docs/base-v2-migration-plan.md`), which removes the porting merges and most of the drift between lines. This plan covers the conflicts that remain on any branching model. It adds four capabilities to the harness:

| # | Capability | When | What it buys |
|---|---|---|---|
| 1 | **Detect**: a dry-run merge against the PR target | Before evaluation, and again before raising the PR | Conflicts are known before anyone opens GitHub |
| 2 | **Resolve**: mechanical conflicts resolved, semantic ones sent to the developer | When step 1 finds conflicts | Engineers stop hand-resolving imports, i18n keys and changelog includes |
| 3 | **Prove**: the resolve branch is checked to still carry exactly the ticket's change | After every resolution | A bad resolution is caught before review, not in QA |
| 4 | **Prevent**: overlap with other open PRs is flagged at planning | When the repos and track are confirmed | The developer can wait, coordinate or narrow the change before writing code |

### Design constraints

- **Cost scales with the ticket.** Steps 1, 3 and 4 are deterministic scripts: no agent and no model reasoning over raw diffs. When nothing overlaps and nothing conflicts, a ticket pays for three short script runs and nothing else. Resolution (step 2) costs model time only when there is a conflict to resolve.
- **Humans keep authority.** No auto-merge and no unattended bot on other engineers' PRs. Semantic conflicts are never decided by the agent. The existing Git safety rules stand: no force-push, no rebase of a pushed branch, no blanket `--ours`/`--theirs`, and no merging the target into the ticket branch.
- **Nothing to set up per developer.** Steps 1–3 need only git ≥ 2.38 for `merge-tree --write-tree`; the current Git for Windows is 2.55. Step 4 uses `gh` when `gh auth status` succeeds and is skipped with a one-line note when it does not.
- **One source of truth.** The rules live in `git-workflow` → Merge conflicts. `commands/work.md` and the agents reference that section; they do not restate it.

## Where it fits in `/work`

```
 6 Planner ─► 7 Confirm repos + track ◄── [4] overlap report
              8 Branches
              9 Implementor
              9a Conflict check ◄──────── [1] dry-run merge vs pr_target
                 └─ conflicts ─► [2] resolve on resolve branch ─► [3] equivalence check
             10 Evaluator  (also reviews the resolution and the equivalence report)
             11 Verdict
             12 PR ◄───────────────────── [1] re-check vs latest target
                 └─ new conflicts ─► [2] + [3], flagged in the PR for the reviewer
```

Running step 1 **before evaluation** means that most resolutions are reviewed by the Evaluator like any other change. The re-check at step 12 is a backstop for the target moving during evaluation.

---

## Step 1: Detect

**Mechanism.** `git -C <repo> fetch origin`, then:

```
git -C <repo> merge-tree --write-tree --name-only --messages origin/<pr_target> <head>
```

This merges in memory and touches neither the working tree nor any ref. Exit code 0 means the merge is clean. Exit code 1 means conflicts: the output lists the conflicted files and git's conflict messages (content, modify/delete, rename). `<head>` is the ticket branch, or the resolve branch once one exists.

**Where it runs.**

- **Step 9a (new), after the implementor reports and before the Evaluator is dispatched**, for every changed repo. A clean result is recorded and the run continues to step 10. Conflicts go to step 2.
- **Step 12, before any PR is raised**, against the freshly fetched target. A clean result means the PR is raised. New conflicts go to step 2 in post-evaluation mode (see Step 2).
- **On `/work` resume at `PR_STAGE_1`**, when the developer returns with review comments or a QA issue: the check runs again before the fix is pushed, because the target has usually moved since the PR was opened.

**Output.** `conflicts.js check` (see *Script*) returns JSON per repo: `clean`, and a list of `{ file, kind, hunks }`, where `hunks` are the conflicting regions with both sides and the enclosing method or block where it can be found. This is everything step 2 needs, so the resolver starts from the conflict and not from the whole file.

## Step 2: Resolve

**When a resolve branch is created.** Only when step 1 reports conflicts against **that** target. A target that merges cleanly gets its PR straight from the ticket branch.

- **One resolve branch per ticket and target.** A base ticket that conflicts with both `base-sandbox-qa` and `gcet-sandbox-qa` gets two.
- **Never merge a long-lived branch into the ticket branch**, whether the target, `base-development` or any other protected branch. The ticket branch stays exactly what was implemented and evaluated, so every later PR from it carries only the ticket.
- **Reuse** an existing resolve branch for the same target while its PR is open. When the target moves, merge the target into it again. When the ticket branch gets a fix, merge the ticket branch into it again. It is never rebased and never force-pushed.
- **A second resolve branch** for the same target is cut only when the first one's PR has already merged and a later change conflicts again. It takes a `-2` suffix, then `-3`, and so on.

**Construction.** Cut the resolve branch **from the ticket branch** and merge `origin/<pr_target>` into it:

```
git -C <repo> switch -c <resolve-branch> <ticket-branch>
git -C <repo> merge --no-ff origin/<pr_target>
```

This is how the team builds most resolve branches. The code is identical to cutting from the target and merging the ticket in, and the merge commit names the target it reconciles with. **Never re-apply the ticket's commits by cherry-pick or by hand** onto a fresh branch: that breaks the history link to the commits that were evaluated, and any hand-copied change becomes a new, unreviewed edit.

**Naming.** The harness generates the name; it never asks the developer to type one:

```
<ticket-branch>-<pr_target>-conflict-resolved[-<n>]

base/bugfix/GSIS-28533-coa-duplicate-scoped-by-university-base-sandbox-qa-conflict-resolved
base/bugfix/GSIS-28533-coa-duplicate-scoped-by-university-gcet-sandbox-qa-conflict-resolved
base/bugfix/GSIS-28533-coa-duplicate-scoped-by-university-base-sandbox-qa-conflict-resolved-2
```

- It is the only form in use that names the target, which matters once a ticket has several resolve branches.
- It starts with the ticket branch, so it keeps the line prefix (`base/…`, `gcet/…`, `gutech/…`) that CI validates, and it never adds a second one.
- The ticket branch's Jira key and case are kept as they are.

**Who resolves.** The **implementor**, dispatched in a new **resolve** mode. Its scope is the conflicted hunks from step 1, and it must not extend the change. It owns code changes and verification already, and keeping resolution in a subagent keeps diff content out of the main session. It creates or reuses the resolve branch as above before merging.

**Classification per hunk, not per file.** A file can hold one mechanical and one semantic hunk.

| Mechanical: resolved by the agent | Semantic: decided by the developer |
|---|---|
| Both sides add distinct entries at the same place: imports, i18n keys, enum or constant entries, route or module registrations, list items | Both sides modify the same existing lines of a method, query, SQL statement or template |
| Both sides append Liquibase changesets or changelog `include`s (keep both; never edit, reorder or renumber an existing changeset) | One side deletes or moves code the other side modifies |
| Formatting-only or whitespace differences | The merged result compiles but the combined behaviour is not obviously what both tickets intended |
| Generated or lock files: regenerate them, don't hand-merge | Anything that needs a business rule to decide |

The Liquibase and component rules come from `engineering-standards`. The resolver reads that skill's relevant stack reference only for the files in conflict.

**Semantic hunks.** The implementor does not resolve them. It returns, per hunk:

- what this ticket intended, taken from the plan;
- what the other side intended, taken from the commit and Jira key that introduced it (`git log origin/<pr_target> -L` over the hunk);
- a proposed resolution and its risk.

The main session presents these in the terminal as one bundled question to the developer. This is not a QA or SME packet: the developer can answer it. The confirmed resolution is recorded as a decision citing both Jira keys, and the implementor applies it.

**After resolving.** Run the verification the plan names for the affected repo (build and the tests covering the conflicted files) on the resolve branch, then run step 3. Record each resolved hunk with its classification and one-line rationale in a new **Conflict resolution** section of the implementation report.

**Post-evaluation mode (step 12).** If new conflicts appear after the last evaluation:

- Only mechanical hunks are resolved. Any semantic hunk stops the run and goes to the developer, as above.
- The resolve branch (created or reused as above) is brought up to date by merging `origin/<pr_target>` into it. It is never rebased.
- Verification and step 3 run as normal. No extra evaluation round follows, which keeps the loop bounded. Instead the PR description gets a **Conflicts resolved after evaluation: reviewer to check** section listing each hunk, its rationale and the equivalence result, mirroring the existing *Fixed after the last evaluation* section.

**Updates after hand-off.** When a ticket's PR is raised from a resolve branch, a later fix goes onto the ticket branch as today. The ticket branch is then merged into the resolve branch, with no rebase and no force, and the resolve branch is pushed. Pushing only the ticket branch, as `work.md` "Coming back" step 5 does now, would leave the open PR stale.

## Step 3: Prove equivalence

This is the check that makes agent-resolved conflicts safe to rely on. It is deterministic, runs after every resolution, and its report goes to the Evaluator, or into the PR in post-evaluation mode.

**Definitions** (per repo):

- **Merged target:** the target commit actually merged into the resolve branch (`merge-base origin/<pr_target> <resolve-branch>`), so a target that moved on later does not show up as reverted lines.
- **Expected:** the ticket's change as a clean PR would show it: the diff from the merge base of the merged target and the ticket branch, to the ticket branch.
- **Actual:** what the resolve branch contributes: the diff from the merged target to the resolve branch.

**Checks.** Compare Expected and Actual per file. The comparison works on the **net change in each line's count**, trimmed and ignoring position, so a line the ticket moves is neither lost nor foreign. Trivial lines (braces, blank lines, lone keywords) are ignored. Each check passes when:

| Check | Pass condition | On failure |
|---|---|---|
| **Contains the ticket head** | The ticket branch's head is an ancestor of the resolve branch | **Blocking.** A fix went onto the ticket branch but was never merged into the resolve branch. |
| **Same files** | Actual touches only files Expected touches, or files the record lists as a post-merge fix; a file Expected touches but Actual does not has its lines already on the target | **Blocking** |
| **Nothing lost** | Each line's net change in Expected is present in the resolve branch, measured from the ticket's base or from the merged target (the second covers a target that made the same change itself) | **Blocking**, unless the record justifies that line |
| **Nothing foreign** | Any net change in a conflicted file beyond Expected is in a file the record lists as resolved | **Blocking.** An unrecorded extra is an unintended edit. |
| **No markers** | No `<<<<<<< ` or `>>>>>>> ` lines in the resolve branch's files | **Blocking** |
| **Unchanged outside conflicts** | Files that did not conflict change exactly as in Expected, unless the record lists them as a post-merge fix (for example, a call site the target renamed) | **Blocking** |

The record is `conflict-resolution-<repo>-<target>.json` in the ticket folder: `resolved` lists each file whose merged content goes beyond either side, with its class and rationale, and `justified` lists any ticket line deliberately not carried over, with the reason. A recorded resolution is not waved through. It appears in the table as "(recorded)", and the Evaluator and the reviewer read it.

**Replay on real history.** The check was run on up to 12 of the most recent resolve PRs per repo and target, into `base-` and `gcet-sandbox-qa`, in admin-backend and frontend: 48 PRs.
- 11 were re-applied without a merge and cannot be replayed.
- Of the other 37, measured at the merge commit with no record, 17 carried exactly the ticket's change.
- The rest contained lines the engineer wrote while resolving, which is what a record lists for review, or were missing part of the ticket. In GSIS-24247 (frontend), four files of the ticket's change never reached the resolve branch that merged into `base-sandbox-qa`.
- Some resolve branches also took review-fix commits that never went back to the ticket branch (GSIS-28533, GSIS-28663). The ticket's other PRs therefore lacked those fixes.

None of this is visible to a reviewer today.

**Output.** `conflicts.js compare` returns JSON plus a short Markdown table (file, status, lines lost, lines foreign). That table goes verbatim into the implementation report and, when the PR comes from a resolve branch, into the PR description. Reviewers then see the proof without re-deriving it.

**Evaluator.** `agents/evaluator.md` gains one rule. When a resolve branch exists, the Evaluator reads the conflict-resolution section and the equivalence report. A blocking equivalence failure is a blocking finding. A mechanical classification that is really semantic is also a blocking finding.

## Step 4: Prevent (overlap with open PRs)

**When.** At step 7, alongside the repo-and-track confirmation the developer already gives. No new question is asked. The overlap report is shown on the same screen, and the developer's answer to step 7 covers it.

**Mechanism** (per changed repo, when `gh auth status` succeeds):

1. `gh pr list --repo <owner>/<repo> --base <pr_target> --state open --json number,title,url,author,headRefName,files`. Also run it for `--base <source_branch>` when that differs from the target.
2. Intersect each PR's files with the files the plan says it will change. Excluded: PRs belonging to this ticket (same Jira key in the head branch), and resolve branches of a PR already counted.
3. For each overlapping file, `gh pr diff <n>` is narrowed to that file. The hunks are mapped to the methods or blocks the plan names. Each overlap is classed as **same area**, meaning the same method, query, component or changeset file region the plan will edit, or **same file, different area**.

Both calls are reads that `git-guard` already allows. The work is done in `conflicts.js overlap`, so the PR diffs never enter the main session's context.

**What the developer sees.** One table. Each row has the file, the PR (number, title, author, age), the class, and a recommended action:

| Class | Recommended action |
|---|---|
| Same file, different area | Proceed. It is listed for awareness and will likely merge cleanly or mechanically. |
| Same area, other PR close to merging (approved or checks green) | Wait for it to merge, then cut the ticket branch from the updated source. |
| Same area, other PR in progress | Proceed and coordinate with its author on the shared method or behaviour. The agreed point is recorded as a decision. |
| Same area, the plan has an alternative | Narrow the change, for example by extending rather than editing the shared method. The Planner's plan is amended only if the developer asks. |

Hot files that almost every ticket touches (shared i18n bundles, master changelogs, route registries) would make a file-level check noisy. Classing by area is what keeps the table short. When a hot file shows only appended entries on both sides, it is reported as "same file, different area".

**Limits, stated in the output.** The check sees only pushed PRs, and only at planning time. Work that has not been pushed, and PRs opened after planning, are caught by step 1 later. The team can make step 4 far more effective by opening **draft PRs early**. That is a team practice outside the harness, and it is noted in the README.

**Recorded.** The overlap result per repo, whether clean, skipped (no `gh`) or overlapping (with PR numbers and class), goes into `state.json` and the journal. The developer's chosen action is recorded as a decision when it is anything other than "proceed".

---

## Script

One file, **`skills/git-workflow/scripts/conflicts.js`**, with a self-test **`conflicts.selftest.js`**. This follows the pattern of `jira-attachments/scripts/attachments.js`: plain Node with no dependencies, JSON on stdout and a non-zero exit only on error.

| Subcommand | Does | Used by |
|---|---|---|
| `check <repo> <target> <head>` | Step 1: dry-run merge, conflicted files, hunks with both sides and the enclosing block | Step 9a, step 12, resume |
| `name <repo> <ticket-branch> <target>` | The resolve-branch name, the existing ones for that target, and the next suffix | Resolve mode |
| `compare <repo> <target> <ticket-branch> <resolve-branch> [--record <file>]` | Step 3: the six equivalence checks, reading the record for justified lines and resolved files | After every resolution; the Evaluator re-runs it |
| `overlap <repo> <owner/repo> <base>... --files <list> --areas <json>` | Step 4: open-PR overlap, classed by area | Step 7 (PR 2) |

The script reads blobs through a single `git cat-file --batch` process, so a large diff costs seconds rather than thousands of process spawns.

The self-test builds throwaway repositories in the OS temp directory and covers:
- a clean merge;
- an import collision;
- both sides appending Liquibase changesets;
- a same-method semantic conflict, with the enclosing method named;
- a correct resolution;
- a line the ticket moves;
- a resolution that drops a ticket line (must fail), and the same line justified (passes);
- leftover markers (must fail);
- unrecorded edits in a conflicted file and in an untouched file (must fail), and the same edits recorded (pass);
- a ticket branch that moved on after the resolution (must fail until the ticket branch is merged in again);
- a target that moved on after the resolution (must still pass);
- naming, with and without an existing resolve branch.

`overlap` is tested against a stubbed `gh` on `PATH`.

## Delivery

Two PRs. PR 1 covers steps 1–3 and the guard, which are the core value and the safety net. PR 2 adds step 4, which is more heuristic, needs tuning against real PRs and depends on `gh` being authenticated.

### PR 1: detect, resolve, prove

| File | Change |
|---|---|
| `skills/git-workflow/SKILL.md` | **Merge conflicts** rewritten as the single source for steps 1–3: the script commands; when to check; when a resolve branch is created, reused or suffixed; its construction and name; the mechanical/semantic table; the record; the equivalence checks; the PR |
| `skills/git-workflow/scripts/conflicts.js` + `.selftest.js` | New: `check`, `name`, `compare` |
| `skills/git-workflow/references/branching-analysis.md` | §4: in-place and construction breakdowns, 30-day naming, the replay |
| `hooks/scripts/git-guard.js` + self-test | Blocks a merge, or a pull naming a branch, of a protected branch unless the current branch ends in `-conflict-resolved[-<n>]`. `merge-base` and `merge-tree` are no longer mistaken for `merge`. Before this change, the guard blocked the Evaluator's own `merge-base` command. |
| `commands/work.md` | New step 9a (conflict check, then resolve mode). Step 10 passes the `compare` command to the Evaluator. Step 12 re-checks, with post-evaluation mode. "Coming back" runs 9a and pushes the resolve branch the PR shows. |
| `agents/implementor.md` | **Resolve mode** |
| `agents/evaluator.md` | Re-runs `compare` and inspects each recorded hunk; the blocking conditions are those in step 3 |
| `templates/implementation-report.md` | **Conflict resolution** section |
| `skills/brain/SKILL.md` | `repos.<repo>.resolve` in `state.json`; events `conflicts_checked` and `conflicts_resolved`; stage `resolve`; two recording moments |
| `README.md` | What `/work` does with conflicts |
| `.claude-plugin/plugin.json` | Version bump, last, after syncing with `main` |

The runtime repo's `dashboard/labels.json` carries labels for the two new events and the `resolve` stage. It is pushed straight to the runtime repo's `main`.

### PR 2: prevent

- `conflicts.js overlap`, with its stubbed-`gh` test.
- Step 7 of `work.md` shows the overlap table.
- `git-workflow` gets an **Overlap with open PRs** section.
- `state.json` and the journal get the overlap result, with an `overlap_checked` event and its dashboard label.
- The README gets the draft-PR recommendation.

## What does not change

- **Branch routing, ticket-branch naming and protected branches.**
- **Git safety rules.** No force-push, no rebase of pushed branches, no auto-merge, no blanket `--ours`/`--theirs`, and no merging the target into a ticket branch.
- **The evaluation gate.** Evaluation is never skipped, and post-evaluation resolution adds no round. The PR reviewer gets an explicit section instead.
- **Scope of agent PRs.** Resolution applies only to the PRs the harness itself raises. It does not touch other engineers' PRs, promotion PRs or ports.

## Verification

1. `node skills/git-workflow/scripts/conflicts.selftest.js` passes every case listed under *Script*.
2. The hook self-tests (`git-guard`, `telemetry`, `jira-guard`) and `attachments.selftest.js` pass. The `git-guard` suite covers merges into ticket and resolve branches, pulls with and without a branch, `--abort`, and `merge-base`/`merge-tree`.
3. **Replay on real history**, as reported under step 3. It exercised `check` and `compare` on 37 real resolutions, including Liquibase and multi-file semantic conflicts. It found one false alarm, a line the ticket moved, which is fixed and covered by the self-test. Branches that were re-applied without a merge cannot be replayed, because nothing links them to the ticket's commits.
4. **One live ticket end to end** on the light track, covering step 9a and step 12. This needs a real ticket whose target conflicts.
5. PR 2: an overlap replay on one ticket from step 3, with the PRs that were open at the time. The conflicting PR must appear as "same area".

## Out of scope

- **Hot-file restructuring** (for example, one Liquibase changelog per ticket through `includeAll`, or i18n split per module). This could remove a whole class of conflicts, but it is a code-repo change owned by those repos. It should be decided on data first: which files the resolve branches of the last window actually touched.
- **Porting onto other customer lines, and promotion PRs.** These are human work under `git-workflow` → Agent PR scope, and they disappear with the single trunk.
- **Scheduled or unattended conflict refresh** of open PRs. The re-check runs on `/work` resume. A bot pushing to branches on a schedule is outward-facing and is not proposed.
