# Branching & Merge Practice — Repository Analysis

Evidence behind the `git-workflow` skill. It records how the team **actually** branches and merges, and where that differs from the skill and from the previous version of this analysis.

| | |
|---|---|
| Analysis window | **2026-06-20 → 2026-09-20** (last 3 months; older decisions may be overridden) |
| Repositories | `pbsgears/sis-product-sis-admin-backend` (**BE**) and `pbsgears/sis-product-sis-frontend` (**FE**), plus a branch/volume census of the other 6 services |
| CI rules | `pbsgears/sis-product-devops-workflows` — `pr-validation.yml` (last changed 2026-09-18), `each-microservices-contains-this-workflow.yml` (2026-09-14), `build-deploy-osos-qa-workflow.yml` (new, 2026-09-18) |
| Prepared | 2026-09-20, from freshly fetched read-only clones; nothing was written to GitHub |
| Supersedes | the 2026-09-15 version (window 2026-07-15 → 2026-09-15) |

The March 2026 team diagram is **no longer used as a reference** — it predates the 2026-03-24 CI rework and describes an environment ladder retired six months ago. It is kept for the record at [`docs/branching-strategy-2026-03-20.pdf`](../../../docs/branching-strategy-2026-03-20.pdf).

## Method and caveats

- **Merges:** first-parent merge commits on each long-lived branch. The source branch comes from the GitHub subject `Merge pull request #N from pbsgears/<branch>`, and the merger is the merge commit's author.
- **Ticket identity:** the Jira key in the branch name (`GSIS-…`, `STT-…`). "First merged into X" means the first PR for that key into X.
- **Reaching a `*-qa` branch** is measured by *commit containment*, not by branch name: promotion PRs (`*-sandbox-qa` → `*-qa`) carry no Jira key, so for each ticket's sandbox merge commit we find the promotion that first contained it. The previous version inferred this from branch names and produced degenerate numbers.
- **Branch origin:** the candidate long-lived branch whose merge-base with the ticket branch is the **newest commit**, sampled on the 15 most recent non-resolve ticket branches per line. The previous version used "fewest commits ahead", which systematically favours slow-moving branches such as `base-development`; that method is wrong and has been replaced.
- **Newly created long-lived branches inherit the merge history of whatever they were cut from.** `osos-sandbox-qa`/`osos-qa` (cut 2026-09-18) and the `pre-hotfix-*` branches each appear to have 130–320 merges in the window; almost all of that is inherited gcet history. Counts for those branches below are **post-fork only**.
- **Clone/backup branches are excluded** (`*-clone*`, `*-backup*`, experiment branches).
- People are referred to by role. The lead developer, developers and QA were identified from who merges where.

## 1. The flow in practice

```
base/{feature|bugfix}/<KEY>-<desc>   (cut from base-sandbox-qa, 14-15/15)
   │  PR (developers merge; ~38-44% via a resolve branch)
   ▼
base-sandbox-qa ──PR──► base-qa            (auto-deploy on merge)
   │
   │  ≈0.8 days after the ticket reaches base-qa
   ▼  PR per applicable customer line (QA merges; ~34-37% via a resolve branch)
gcet-sandbox-qa ──PR──► gcet-qa            (auto-deploy on merge; QA verifies)
gutech-sandbox-qa ─PR─► gutech-qa          (auto-deploy on merge; QA verifies)
osos-sandbox-qa ──PR──► osos-qa            (TEMPORARY hardening line, 2026-09-18 → UAT; to be discontinued)
   │
   │  ≈4–5.5 days after arriving on the customer QA env
   ▼  PR (lead developer merges)
base-development                           (record of verified base tickets; not deployed)

gcet/… gutech/… tickets: cut from and PR'd into their own {line}-sandbox-qa → {line}-qa
Images:     gcet-qa ──► osos-qa ──► osos-staging, promoted by commit SHA via GitOps
Hotfixes:   {gcet|gutech|osos}/hotfix/* → pre-hotfix-<env>-<commit> → back-merge to sandbox
```

## 2. Merge volume (2026-06-20 → 2026-09-20)

| Target branch | BE | FE | Where the PRs come from | Merged by |
|---|---|---|---|---|
| `base-sandbox-qa` | 389 | 384 | base tickets (388 / 383) | Developers, including the lead (BE 51%, FE 48%) |
| `base-qa` | 145 | 139 | `base-sandbox-qa` promotions (143 / 137); `base/*/*` directly (2 each) | Lead developer (BE 74%, FE 71%) |
| `base-development` | 108 | 105 | base ticket and resolve branches | Lead developer (BE 95%, FE 96%) |
| `gcet-sandbox-qa` | 322 | 314 | base tickets 188 / 193 (58% / 61%); gcet tickets 132 / 118; reverts 2 each; pre-hotfix 0 / 1 | QA (93% both) |
| `gcet-qa` | 162 | 151 | `gcet-sandbox-qa` promotions only | QA (93% both) |
| `gutech-sandbox-qa` | 248 | 263 | base tickets 188 / 198 (76% / 75%); gutech tickets 59 / 64; reverts 1 each | QA (94% both) |
| `gutech-qa` | 131 | 130 | `gutech-sandbox-qa` promotions only | QA (92% / 94%) |
| **`osos-sandbox-qa`** | **3** | **4** | **temporary hardening line, cut 2026-09-18** (see §10); base tickets + `pre-hotfix-*` back-merge | Lead developer / QA |
| **`osos-qa`** | **2** | **3** | `osos-sandbox-qa` promotions and base tickets | Lead developer / QA |
| `gcet-development` | 1 | 1 | one `gcet-qa` back-merge (2026-09-05) | Lead developer |
| `otc-sandbox-qa` / `cbfs-qa` | 1 / 1 | 0 / 0 | isolated, last 2026-07-31 / 2026-07-08 | — |
| `*-master`, `*-release-*`, `*-staging`, `*-uat`, `*-finalized`, `gutech-development` | 0 | 0 | — (legacy since the 2026-03-24 CI rework) | — |

### 2.1 The other six services are nearly dormant

First-parent merges in the window. The previous analysis assumed all 8 repos carry comparable traffic; they do not.

| Repo | base-sbx | base-qa | base-dev | gcet-sbx | gcet-qa | gutech-sbx | gutech-qa |
|---|---|---|---|---|---|---|---|
| `sis-admin-backend` | 389 | 145 | 108 | 322 | 162 | 248 | 131 |
| `sis-frontend` | 384 | 139 | 105 | 314 | 151 | 263 | 130 |
| `business-config-service-backend` | 6 | 7 | 2 | 3 | 3 | 2 | 2 |
| `sis-scheduler-service` | 3 | 4 | 0 | 0 | 0 | 0 | 0 |
| `notification-handler-backend` | 2 | 3 | 1 | 1 | 1 | 1 | 1 |
| `sis-attachment-handler-backend` | 2 | 3 | 0 | 1 | 1 | 1 | 1 |
| `workflow-engine-backend` | 2 | 2 | 1 | 0 | 0 | 0 | 0 |
| `sis-keycloak` | 2 | 3 | 0 | 3 | 1 | 1 | 0 |

All 8 repos carry the same branch set, including the new `osos-*` branches. Only the two analysed repos carry meaningful volume.

## 3. Ordering of a base ticket across stages

| Measure | BE | FE |
|---|---|---|
| Distinct base Jira keys merged in the window | 290 | 314 |
| base tickets first merged into **gcet-sandbox-qa** | 135 | 145 |
| … never went through `base-sandbox-qa` | 2% | 5% |
| … customer sandbox merged **before** `base-sandbox-qa` | 0% | 4% |
| … customer sandbox merged **before the ticket reached `base-qa`** | 10% | 18% |
| … median days from `base-qa` to gcet sandbox | 0.8 | 0.8 |
| base tickets first merged into **gutech-sandbox-qa** | 142 | 152 |
| … customer sandbox merged before reaching `base-qa` | 11% | 15% |
| … median days from `base-qa` to gutech sandbox | 0.8 | 0.8 |
| Median days from customer QA env to `base-development` (gcet / gutech) | 4.2 / 4.6 | 5.2 / 5.5 |
| base tickets merged into **base-development** | 103 | 96 |
| … reached `base-qa` first | 75% | 68% |
| … also went to a customer sandbox | 61% | 54% |
| … **base-only** (no customer-line PR) | **39%** | **46%** |

The base-only share has risen (was 33% / 38%). See §5 — those tickets' code still reaches the customer lines, just not by their own PR.

## 4. Conflict resolution

**Share of ticket-branch PRs raised from a resolve branch** (denominator excludes promotions and reverts):

| Target | BE | FE | Previous window |
|---|---|---|---|
| `base-sandbox-qa` | 171/388 (**44%**) | 144/383 (**38%**) | 40% / 36% |
| `gcet-sandbox-qa` | 119/320 (**37%**) | 106/311 (**34%**) | 33% / 32% |
| `gutech-sandbox-qa` | 92/247 (**37%**) | 88/262 (**34%**) | 31% / 30% |
| `base-development` | 26/108 (24%) | 24/105 (23%) | 24% / 24% |

Conflict load on every sandbox has grown by 3–6 points over the previous window.

**Resolve-branch naming** — distinct resolve branches, classified exclusively (BE 309, FE 298):

| Pattern | BE | FE | Example |
|---|---|---|---|
| `<ticket>-<target-branch>-conflict-resolved` (skill standard) | 85 (**28%**) | 82 (**28%**) | `base/bugfix/GSIS-24373-sponsor-batch-student-bulk-transient-gcet-sandbox-qa-conflict-resolved` |
| `-conflict-resolve(d)`, target not named | 70 | 69 | `base/feature/GSIS-24819-multi-sponsor-batch-assign-conflict-resolved` |
| `<ticket>-<line>-conflict` / `-resolve` | 65 | 66 | `base/bugfix/STT-514-regresion-issue-fix-gcet-conflict` |
| Other: suffix before the target, mid-name, typos | 59 | 62 | `base/bugfix/gsis-12132-inactive-status-not-change-conflict-resolved-gcet-sandbox-qa` |
| `-conflict` / `-resolve` alone | 30 | 19 | `base/feature/stt-429-planner-notification-dispatch-gcet-conflict` |

Adherence to the skill's name is unchanged at 28%. Resolve branches keep the ticket's `base/…` prefix, because CI only accepts `base/*/*` into customer sandboxes.

## 5. `base-development` is already contained in the customer lines

This is the largest single change since the previous analysis, and it was not visible in it.

| Test | BE | FE |
|---|---|---|
| `base-development` merge commits in the window contained in **`gcet-qa`** | **107 / 108** | **104 / 105** |
| … contained in **`gutech-qa`** | **107 / 108** | **104 / 105** |
| Commits in `base-development` but not in `gcet-qa` (all history) | **18** | **10** |
| Commits in `gcet-qa` but not in `base-development` | 4,524 | 3,917 |

The mechanism is three wholesale merges of `base-development` into the customer sandboxes:

- `base/bugfix/base-development-conflict-fix-gcet` and `…-gutech` → `gcet-sandbox-qa` / `gutech-sandbox-qa`, **2026-08-03** and **2026-08-05**
- `base/bugfix/GSIS-27698-placement-test-attendance-base-development-gcet` → `gcet-sandbox-qa`, **2026-09-07**

Consequence: the "base-only" tickets of §3 have **no customer PR of their own, but their code is on `gcet-qa` and `gutech-qa` anyway**, carried in by those merges. The entire residual gap is one feature — `STT-15 section-group-merge-request` (18 commits BE, 10 FE, merged into `base-development` on 2026-09-18).

## 6. Where ticket branches are cut from

Sample: the 15 most recent non-resolve ticket branches per line; origin = candidate with the newest merge-base.

| Line | BE | FE |
|---|---|---|
| `base/*` | **15 from `base-sandbox-qa`** | 14 from `base-sandbox-qa`, 1 from `base-development` |
| `gcet/*` | 15 from `gcet-sandbox-qa` | 14 from `gcet-sandbox-qa`, 1 from `gcet-qa` |
| `gutech/*` | 15 from `gutech-sandbox-qa` | 15 from `gutech-sandbox-qa` |

Unchanged from the previous window, and still the opposite of what the skill asks for.

## 7. Branch names used for PR heads

Distinct source branches in the window, including resolve branches:

| Prefix | BE | FE |
|---|---|---|
| `base/bugfix` | 366 | 401 |
| `base/feature` | 165 | 159 |
| `gcet/bugfix` | 90 | 86 |
| `gutech/bugfix` | 43 | 51 |
| `gcet/feature` | 12 | 12 |
| `gutech/feature` | 4 | 4 |
| `base/devops` | 3 | 3 |
| **`base/hotfix` / `gcet/hotfix` / `gutech/hotfix`** | 2 / 1 / 0 | 0 / 2 / 1 |
| Off-convention: `base/task`, `gcet/task`, `base/bug-fix` | 2, 1, 1 | 0, 0, 1 |
| `otc/bugfix` | 1 | 0 |
| `revert-*` (GitHub revert button) | 3 | 3 |

Jira keys appear in both cases (`GSIS-26471-…` and `gsis-26627-…`). New since the previous window: a `{line}/hotfix/*` type in regular use, and `gcet/bugfix/gcet-sb/<key>` sub-namespacing.

## 8. CI rules and deploy triggers (devops-workflows)

**`pr-validation.yml`** allows these merge paths:
- `base/*/*` → `base-sandbox-qa`, `base-qa`, `base-development`, `gcet-sandbox-qa`, `gutech-sandbox-qa`, **`osos-sandbox-qa`**
- `<brand>/*/*` → `<brand>-sandbox-qa`
- `<brand>-sandbox-qa` → `<brand>-qa` → `<brand>-development` → `<brand>-master`, plus `<brand>-master` → `<brand>-development`
- `gcet|gutech|osos/hotfix/*` → `pre-hotfix-*`
- `pre-hotfix-*` → `*-sandbox-qa`, `*-development`
- `gcet-development`/`gutech-development` → their sandbox
- `revert-*` → `*-sandbox-qa`
- Legacy: `gcet|gutech-hotfix-*` → `*-master`
- **Blocked:** cross-brand merges, unless one side is base.
- **Emergency bypass:** any PR whose source is `bypass-all-branches-becarefully` passes.

Brands: `gutech gcet otc cbfs upgradebase saas osos`. Anything else counts as base.

**Change history in the window** — every edit is about formalising hotfixes or standing up the hardening line:
- **2026-06-25:** allow `gcet/hotfix/*` and `gutech/hotfix/*` → `pre-hotfix-*` (formalising the June staging firefight, §9).
- **2026-08-25:** allow `revert-*` → `*-sandbox-qa`.
- **2026-09-09:** add `osos` to `BRANDS`; allow `osos/hotfix/*` → `pre-hotfix-*`.
- **2026-09-18 (three edits):** first allow `gcet-qa` → `osos-sandbox-qa`, then correct the glob, then **replace it with `base/*/* → osos-sandbox-qa`**. This is the CI side of standing up the temporary hardening line (§10): seeding it from `gcet-qa` was dropped in favour of letting hardening tickets land on it directly, so the sprint does not have to queue behind the gcet QA backlog.

**Deploys:**
- The canonical template (`each-microservices-contains-this-workflow.yml`) deploys on merged PRs into `base-qa`, `gcet-qa`, `gutech-qa`, namespace = branch.
- Each repo's own `all-deploy-workflow.yml` adds a **`deploy-osos-qa`** job (2026-09-18) calling the new `build-deploy-osos-qa-workflow.yml`. `osos-qa` is a live auto-deploy target in both analysed repos.
- **SonarQube quality gate** runs on PRs into `base-sandbox-qa` only (moved there from `gcet-qa` on 2026-09-14). Agent PRs to `base-sandbox-qa` hit it; it is deliberately not gated on `validate-pr`.
- `copy-gcet-qa-images-to-osos.yml` (manual dispatch, with a consent checkbox and atomic all-8-services resolution) promotes images along **`gcet-qa` → `osos-qa` → `osos-staging`**, SHA-pinned into GitOps values files. One shared ACR; nothing is copied between registries.
- `build-deploy-staging-workflow.yml` and `build-deploy-uat-workflow.yml` have been **no-op stubs since 2026-03-19**.
- `prod-release.yml` is a manual dispatch (product GCET/GUTECH/OTC, release version, reviewer name); last touched 2026-04-27, and no `*-release-*` or `*-master` branch has moved since 2025-12-21.

**Environments that exist** (from the devops README's ad-hoc DB backup matrix): products `base, gcet, gutech, otc, cbfs, upgradebase, osos` across `qa`, `staging`, `uat` — `base` and `upgradebase` are qa-only, `osos` has no `uat`. So gcet, gutech, otc and cbfs each have staging **and** UAT databases.

## 9. Hotfix activity — two real firefights in the window

`pre-hotfix-*` branches inherit the history of whatever they were cut from; the counts below are post-fork.

| Line | Branch | Real merges | Window | Source |
|---|---|---|---|---|
| GCET staging | `pre-hotfix-gcet-staging-june-24-72564bd5d4` (BE) / `-f6c71d0` (FE) | 21 / 24 | 2026-06-24 → 2026-07-10 | `gcet/hotfix/*` (~30 distinct branches) |
| OSOS staging | `pre-hotfix-osos-staging-31feab8` (BE) / `-4d9b17d` (FE) | 3 / 3 hotfixes + periodic `gcet-sandbox-qa` forward-merges | 2026-09-02 → 2026-09-19 | `osos/hotfix/*` |
| — | `pre-hotfix-admin-backend-sep-18-2026` / `-frontend-` | cut 2026-09-18, back-merged into `osos-sandbox-qa` | 2026-09-18 | seeding the temporary hardening line |

The GCET wave is a concentrated two-week stream of hotfixes against a deployed staging snapshot. The OSOS staging branch is kept current by merging `gcet-sandbox-qa` into its pre-hotfix branch every few days.

## 10. Other lines and branches

| Line / branch | Activity |
|---|---|
| **OSOS** | **A temporary hardening line, not a new customer line.** `osos-sandbox-qa` + `osos-qa` were cut from the gcet line on 2026-09-18 **on the developer's instruction**, to run a hardening sprint bound for UAT without disrupting the QA feature backlog already raised against `gcet-sandbox-qa`. They carry live auto-deploy and a CI merge path, and will be **discontinued** when the sprint ends. `osos-staging` (fed by image promotion) and the `osos/hotfix/*` stream since 2026-09-09 belong to the same sprint. |
| otc | BE: 1 merge into `otc-sandbox-qa` (2026-07-31); `otc-qa` last 2026-03-18. FE: last activity 2026-03-27. Still listed in `prod-release.yml`. |
| cbfs | BE: last 2026-07-08; FE: last 2025-10-20 |
| saas, upgradebase | No activity in the window (last 2026-04-28/29 and 2025-12) |
| `gutech-development` | No merges; last commit 2026-04-30 (BE) / 2026-05-04 (FE) |
| Clones / backups | `gcet-sandbox-qa-clone` (2026-09-01), `gcet-qa-clone-aug-7`, `*-backup-*`, `*-previous`, experiment branches |
| `bypass-all-branches-becarefully` | Exists; still accepted by CI |
| Totals | BE 3,313 branches (160 without `/`), FE 3,073 (128). **No tags** in either repo. Up ~50 branches in 3 months. |
| Protected-pattern coverage (skill) | BE 109 flat branches matched, FE 103; no branch containing `/` is matched, so ticket branches stay writable. `osos-sandbox-qa`/`osos-qa` are already covered by `*-sandbox-qa` / `*-qa`. |

## 11. Deviations

### 11.1 Previous version of this analysis (2026-09-15) vs. reality

| Previous claim | Now |
|---|---|
| "OSOS: only `pre-hotfix-osos-staging-*`. No `osos-sandbox-qa`/`osos-qa`." | **Out of date since 2026-09-18**, though the underlying judgement held: those branches now exist with auto-deploy, but as a temporary hardening line (§10), not as a fourth customer line. |
| "The numbers for the two analysed repos are nearly identical [to the other 6]." | **Wrong.** The other 6 services carry 0–7 merges in 3 months against 384–389. |
| 13/15 base branches cut from `base-sandbox-qa` | Still true (14–15/15), but the previous figure came from a heuristic biased toward slow branches; re-derived with a sound method. |
| Stage-ordering percentages (12% before `base-qa`, medians 0.7–0.8 d) | Medians confirmed (0.8 d). The "before `base-qa`" share is 10–11% BE, 15–18% FE. |
| "`base-development` differs textually from the customer lines" | **Overturned.** 107/108 BE and 104/105 FE `base-development` merges are already contained in both `gcet-qa` and `gutech-qa` (§5). |
| Environment ladder retired; prod promoted by image SHA | Confirmed, and now documented explicitly by `copy-gcet-qa-images-to-osos.yml`. |

### 11.2 `git-workflow` skill vs. reality (intentional, decided by the team)

The skill routes on the Jira **Customer Name** field and stops at one PR per repo; the stages after that PR are human work it deliberately does not describe. Where it still constrains agents, it differs from observed practice on purpose:

| Skill rule for agents | Team practice | Why the skill differs |
|---|---|---|
| Cut `base/*` from **`base-development`** | 14–15/15 cut from `base-sandbox-qa` | A branch cut from the sandbox carries other unverified tickets into the PR |
| Resolve branch named `<ticket>-<target-branch>-conflict-resolved` | 28% follow it | One predictable name per target |
| Types `feature`/`bugfix` only | `devops`, `hotfix`, `task`, `bug-fix` occasionally | Consistent names for CI validation and reporting |
| Keep the Jira key's case | Mixed case in practice | Traceability to Jira |
| Agents never raise the promotion, cross-line or `base-development` PRs | Humans raise them, 24% via resolve branches | Those stages need QA verification the agent cannot do |
| OSOS is not a target, though CI allows `base/*/* → osos-sandbox-qa` | A live auto-deploying line | It is a temporary hardening stream (§10), human-driven; revisit when the branches are removed |

## 12. Observations and risks

1. **Porting duplicate work is 35–36% of all developer-facing merges** (BE 376 of 1,067; FE 391 of 1,066). Each base ticket is re-resolved per customer line, and the cost grows with every line the product carries.
2. **Conflict load is rising**: 44% of base-sandbox PRs now need a resolve branch, up from 40% one window ago, with similar rises on both customer lines.
3. **Resolve branches are not checked against the ticket.** Nothing verifies that `…-conflict-resolved` contains the same change as the ticket branch, so a bad resolution reaches QA unnoticed.
4. **`base-development` has been merged wholesale into the customer sandboxes** (2026-08-03, 2026-08-05, 2026-09-07). This quietly pushed base-only, never-QA'd work onto `gcet-qa` and `gutech-qa`, and it is the opposite of the staged flow the skill describes. It also means "which line has what" can no longer be answered from PR history alone.
5. **Isolating a release stream costs a whole cloned line.** To run a hardening sprint in parallel with the QA feature backlog, the team had to cut a branch pair from `gcet-*`, add a CI merge path, write a new reusable deploy workflow and add a deploy job in each of the 8 repos (§10). The branching model offers no cheaper way to stabilise a release while normal work continues, so isolation is bought by duplication — and every clone starts with the source line's full divergence baked in.
6. **25–32% of tickets in `base-development` show no `base-qa` promotion beforehand**, unchanged from the previous window.
7. **CI lets `base/*/*` go straight into `base-qa`**, skipping the sandbox, and the bypass branch passes any PR. Both rely on discipline.
8. **No tags; versions are image SHAs.** "Which ticket is on which environment" is answered only by inspecting branches and GitOps values files.
9. **~3,100–3,300 branches per repo** and growing ~50 per quarter. Merged ticket and resolve branches are not deleted.
10. **Staging and UAT environments exist per customer** (gcet, gutech, otc, cbfs have both; osos has staging) with live databases and their own hotfix streams. Any migration plan that assumes "only QA environments exist" is wrong.

## 13. Improvement ideas (no change to how QA tests on the customer QA envs)

- **Equivalence check for resolve branches:** `git range-diff` or a `patch-id` comparison against the ticket branch, posted on the PR.
- **Branch-name validation** in `pr-validation.yml`: line, type, Jira key, and the resolve suffix.
- **Cross-line propagation report:** per Jira key, which of `base-qa` / `gcet-qa` / `gutech-qa` / `base-development` contain it (by `patch-id`), flagging tickets stuck between stages. This would also have surfaced the wholesale `base-development` merges of §5 when they happened.
- **A cheaper way to isolate a release**, so stabilising a stream for UAT does not require cloning a line, CI path and deploy workflow (§12.5).
- **Auto-delete** merged ticket and resolve branches.
- **Tags** (or a release manifest) on each GitOps promotion — `copy-gcet-qa-images-to-osos.yml` already resolves immutable SHAs and could record them.
- **A revert convention**, so reverts are traceable to the Jira key instead of `revert-NNNN-…`.

## Refreshing this analysis

Read access only. Blobless clones keep it light.

```bash
git clone --bare --filter=blob:none https://github.com/pbsgears/<repo>.git
# per long-lived target branch T:
git log --first-parent --merges --since=<start> --format="T|%ct|%H|%s" T
# containment (when did a ticket reach a *-qa branch):
git log --first-parent --merges --since=<start> --format="%ct %H" origin/<line>-qa |
  while read e h; do git rev-list --merges $h^1..$h | sed "s/^/$e /"; done
# branch origin (newest merge-base wins, NOT fewest-commits-ahead):
git merge-base <ticket-branch> origin/<candidate>
```

Group results by the source branch named in the merge subject. **Check first whether any long-lived branch was created inside the window** (`git merge-base` against its likely parent) — if so, its merge count is inherited history, not traffic. Limit the window to the last three months and update the `git-workflow` skill if practice has changed.
