# Branching & Merge Practice — Repository Analysis

Evidence behind the `git-workflow` skill. It records how the team **actually** branches and merges, and where that differs from the branching diagram, the earlier analysis, and the skill itself.

| | |
|---|---|
| Analysis window | **2026-07-15 → 2026-09-15** (last 2 months; older decisions may be overridden) |
| Repositories | `pbsgears/sis-product-sis-admin-backend` (**BE**, one of 7 Spring Boot services) and `pbsgears/sis-product-sis-frontend` (**FE**, Angular UI) |
| CI rules | `pbsgears/sis-product-devops-workflows` — `pr-validation.yml` (last changed 2026-09-09), `each-microservices-contains-this-workflow.yml` (2026-09-14) |
| Team diagram | [`branching-strategy-2026-03-20.pdf`](branching-strategy-2026-03-20.pdf) |
| Prepared | 2026-09-15, read-only clones; nothing was written to GitHub |

The other 6 services are stated by the team to follow the same strategy but were not analysed. The numbers for the two analysed repos are nearly identical.

## Method and caveats

- **Merges:** first-parent merge commits on each long-lived branch. The source branch comes from the GitHub subject `Merge pull request #N from pbsgears/<branch>`, and the merger is the merge commit's author.
- **Ticket identity:** the Jira key in the branch name (`GSIS-…`, `STT-…`). "First merged into X" means the first PR for that key into X.
- **Branch origin:** the nearest long-lived branch by merge-base, sampled on the 15 most recent ticket branches per line. This is a heuristic, not a record of `git checkout -b`.
- **Clone/backup branches are excluded** (`*-clone*`, `*-backup*`, and experiment branches), because they inherit history and would inflate counts.
- People are referred to by role. The lead developer, developers and QA were identified from who merges where.

## 1. The flow in practice

```
base/{feature|bugfix}/<KEY>-<desc>
   │  PR (developers merge; ~1/3 via a resolve branch)
   ▼
base-sandbox-qa ──PR──► base-qa            (auto-deploy on merge)
   │
   │  ≈0.7–0.8 days after the ticket reaches base-qa
   ▼  PR per applicable customer line (QA merges; ~1/3 via a resolve branch)
gcet-sandbox-qa ──PR──► gcet-qa            (auto-deploy on merge; QA verifies)
gutech-sandbox-qa ─PR─► gutech-qa          (auto-deploy on merge; QA verifies)
   │
   │  ≈4–5 days after arriving on the customer QA env
   ▼  PR (lead developer merges)
base-development                           (record of verified base tickets; not deployed)

gcet/… and gutech/… tickets: cut from and PR'd into their own {line}-sandbox-qa → {line}-qa
Production: images built on *-qa merges are promoted by commit SHA via GitOps (no branch promotion)
Hotfixes:   {gcet|gutech|osos}/hotfix/* → pre-hotfix-<env>-<commit>
```

## 2. Merge volume (2026-07-15 → 2026-09-15)

| Target branch | BE | FE | Where the PRs come from | Merged by |
|---|---|---|---|---|
| `base-sandbox-qa` | 283 | 298 | base tickets (BE 112, FE 108 via resolve branches) | Developers, including the lead |
| `base-qa` | 105 | 102 | `base-sandbox-qa` promotions (BE 103, FE 100); `base/devops/*` directly (2 each) | Mostly the lead developer (BE 69%, FE 63%) |
| `gcet-sandbox-qa` | 238 | 244 | base tickets: BE 139, FE 153 (about 58–63%); gcet tickets: BE 97, FE 87; revert branches: 2 each | QA (BE 92%, FE 93%) |
| `gcet-qa` | 120 | 116 | `gcet-sandbox-qa` promotions only | QA (92–93%) |
| `gutech-sandbox-qa` | 185 | 210 | base tickets: BE 143, FE 161 (about 77%); gutech tickets: BE 41, FE 47; revert: 1 each | QA (93–94%) |
| `gutech-qa` | 95 | 101 | `gutech-sandbox-qa` promotions only | QA (92–94%) |
| `base-development` | 99 | 94 | base tickets: BE 75, FE 71; their `-base-development` resolve branches: BE 24, FE 23 | Lead developer (96%) |
| `gcet-development` | 1 | 1 | one `gcet-qa` back-merge (2026-09-05) | Lead developer |
| `*-master`, `*-release-*`, `*-staging`, `*-uat`, `*-finalized` | 0 | 0 | — (legacy since the 2026-03-24 CI rework) | — |

## 3. Ordering of a base ticket across stages

| Measure | BE | FE |
|---|---|---|
| base tickets first merged into **gcet-sandbox-qa** in the window | 103 | 119 |
| … never went through `base-sandbox-qa` | 1% | 5% |
| … customer sandbox merged **before** `base-sandbox-qa` | 0% | 1% |
| … customer sandbox merged **before the ticket reached `base-qa`** | 12% | 12% |
| … median days from `base-qa` to customer sandbox | 0.7 | 0.8 |
| base tickets first merged into **gutech-sandbox-qa** | 109 | 126 |
| … customer sandbox merged before reaching `base-qa` | 12% | 12% |
| … median days from `base-qa` to customer sandbox | 0.7 | 0.8 |
| Median days from customer QA env arrival to `base-development` (gcet / gutech) | 3.8 / 3.8 | 4.9 / 5.2 |
| base tickets merged into **base-development** | 98 | 91 |
| … reached `base-qa` first | 83% | 74% |
| … also went to a customer sandbox (always before `base-development`) | 67% | 62% |
| … **base-only** (no customer line) | 33% | 38% |

## 4. Conflict resolution

**Share of PRs raised from a resolve branch:**

| Target | BE | FE |
|---|---|---|
| `base-sandbox-qa` | 112/282 (40%) | 108/297 (36%) |
| `gcet-sandbox-qa` | 78/236 (33%) | 78/242 (32%) |
| `gutech-sandbox-qa` | 57/184 (31%) | 62/209 (30%) |
| `base-development` | 24/99 (24%) | 23/94 (24%) |

**Resolve-branch naming** (271 resolve PRs in each repo):

| Pattern | BE | FE | Example |
|---|---|---|---|
| `<ticket>-<target-branch>-conflict-resolved` (skill standard) | 74 (27%) | 77 (28%) | `base/bugfix/GSIS-24490-approval-double-submit-ise-base-development-conflict-resolved` |
| `<ticket>-<line>-conflict` / `-<line>-resolve` | 57 | 58 | `base/bugfix/gsis-26473-offer-letter-pdf-and-excel-issue-base-conflict` |
| `<ticket>-conflict-resolve(d)`, target not named | 62 | 71 | `base/feature/GSIS-24819-multi-sponsor-batch-assign-conflict-resolved` |
| Other (`-development-conflict`, `-new-conflict`, typos like `confilict`) | 78 | 65 | `base/feature/stt-21-weekly-schedule-enhancement-new-conflict` |

Resolve branches keep the ticket's `base/…` prefix, because CI only accepts `base/*/*` into customer sandboxes.

## 5. Where ticket branches are cut from

Sample: the 15 most recent ticket branches per line.

| Line | BE | FE |
|---|---|---|
| `base/*` | **13 from `base-sandbox-qa`**, 1 from `base-development`, 1 deleted | **13 from `base-sandbox-qa`**, 1 from `base-development`, 1 deleted |
| `gcet/*` | 15 from `gcet-sandbox-qa` | 15 from `gcet-sandbox-qa` |
| `gutech/*` | 15 from `gutech-sandbox-qa` | 15 from `gutech-sandbox-qa` |

## 6. Branch names used for PR heads

In the window, including resolve branches:

| Prefix | BE | FE |
|---|---|---|
| `base/bugfix` | 521 | 581 |
| `base/feature` | 138 | 122 |
| `gcet/bugfix` / `gcet/feature` | 75 / 22 | 71 / 16 |
| `gutech/bugfix` / `gutech/feature` | 38 / 3 | 43 / 4 |
| `base/devops` | 3 | 3 |
| Off-convention types: `base/task`, `base/bug-fix` | 2, 1 | 0, 1 |
| `revert-*` (GitHub revert button) | 3 | 1 |

Jira keys appear in both cases (`GSIS-26471-…` and `gsis-26627-…`).

## 7. CI rules and deploy triggers (devops-workflows)

**`pr-validation.yml`** allows these merge paths:
- `base/*/*` → `base-sandbox-qa`, `base-qa`, `base-development`, `gcet-sandbox-qa`, `gutech-sandbox-qa`
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

**Change history:**
- **2026-03-20:** allowed base branches into gcet/gutech sandboxes.
- **2026-03-24:** "remove finalized/staging/uat branches". This is the rework that ended the old environment ladder.

**Deploys (`each-microservices-contains-this-workflow.yml`):**
- Deploys on merged PRs into `base-qa`, `gcet-qa`, `gutech-qa`, with namespace = branch.
- A legacy hotfix deploy runs on `gcet|gutech-hotfix-*` → `*-master`.
- `copy-gcet-qa-images-to-osos.yml` gives OSOS the gcet-qa images.
- **New (2026-09-14):** a SonarQube quality gate runs on PRs into `base-sandbox-qa`. Agent PRs there will hit it.

## 8. Other lines and branches

| Line / branch | Activity |
|---|---|
| OSOS | Only `pre-hotfix-osos-staging-*` (BE 2026-09-10, FE 2026-09-14). No `osos-sandbox-qa`/`osos-qa`. |
| otc | BE: 1 merge into `otc-sandbox-qa` (2026-07-31). FE: last activity 2026-03-27. |
| cbfs | BE: last 2026-07-08; FE: none recent |
| saas, upgradebase | No recent activity (FE saas last 2026-04-28) |
| Clones / backups | `gcet-sandbox-qa-clone`, `gcet-qa-clone-aug-7`, `*-backup-*`, `*-previous`, experiment branches |
| `bypass-all-branches-becarefully` | Exists; FE last commit 2025-12-31 |
| Totals | BE 3,265 branches (156 without `/`), FE 3,023 (124). **No tags** in either repo. |
| Protected-pattern coverage (skill) | BE 106 branches, FE 100 matched; no branch containing `/` is matched, so ticket branches stay writable |

## 9. Deviations

### 9.1 Team diagram (2026-03-20 PDF) vs. reality
| Diagram | Reality |
|---|---|
| Underscore names (`gcet_sandbox_qa`, `gcet_master`) | Hyphens (`gcet-sandbox-qa`, `gcet-master`) |
| Ticket PRs to `base_sandbox_qa` and `gcet_sandbox_qa` side by side | Strictly staged: customer sandboxes about 0.7 days **after** `base-qa` (88%) |
| Customer feature branched from `gcet_development` | Branched from `gcet-sandbox-qa` (15/15) |
| Promotion `gcet_qa` → `gcet_development` → `gcet_master` → `release-*` → staging/UAT | Not used (1 `gcet-development` merge, 0 master/release); prod promoted by image SHA via GitOps |
| Hotfix from `gcet_master`, back-merged via `gcet_development` | `{line}/hotfix/*` → `pre-hotfix-<env>-<commit>` → back-merge into sandbox/development |
| Diagram predates the 2026-03-24 CI rework | CI removed finalized/staging/uat on 2026-03-24 |

### 9.2 Earlier analysis (previous version of this file) vs. reality
The previous version was built from history reaching back to before March 2026. Some of it no longer holds:
- The environment ladder `development → sandbox-qa → qa → sandbox-staging → staging → uat → finalized → master → release-*` is **retired**. Only `sandbox-qa → qa` is active, and deploys fire only on `*-qa`.
- "Release via finalized/master/release branches" and "hotfix off `*-release-*`" are replaced by image-SHA promotion and `pre-hotfix-*` branches.
- **Still accurate:**
  - customer ports of base tickets through per-line resolve branches;
  - no tags;
  - heavy manual conflict resolution;
  - customisation living in branch divergence rather than config;
  - branch hygiene debt.

### 9.3 `git-workflow` skill vs. reality (intentional, decided by the team)
| Skill rule for agents | Team practice | Why the skill differs |
|---|---|---|
| Cut `base/*` from **`base-development`** | 13/15 cut from `base-sandbox-qa` in both repos | A branch cut from the sandbox carries other unverified tickets into `base-development` and the customer sandboxes |
| Resolve branch named `<ticket>-<target-branch>-conflict-resolved` | Only 27–28% follow it | One predictable name per target |
| Stage 2 only after human confirms `base-qa` | 12% reached a customer sandbox before `base-qa` | Keeps unverified base changes out of customer QA |
| Types `feature`/`bugfix` only | `devops`, `task`, `bug-fix` occasionally | Consistent names for CI validation and reporting |
| Keep the Jira key's case | Mixed case in practice | Traceability to Jira |
| Stage 3 (`base-development`) is human-only | 24% of those PRs come from resolve branches | Agents never raise it; unchanged |

## 10. Observations and risks

1. **About a third of every sandbox PR needs a resolve branch.** Each base ticket is resolved again per customer line, so the manual porting cost grows with the number of lines.
2. **Resolve branches are not checked against the ticket.** Nothing verifies that `…-conflict-resolved` contains the same change as the ticket branch, so a bad resolution reaches QA unnoticed.
3. **Cutting base tickets from `base-sandbox-qa`** (the common practice) lets unverified work from other tickets ride along into `base-development`.
4. **17–26% of tickets merged into `base-development`** show no promotion to `base-qa` beforehand. This may be a detection limit of the method; it's worth a human spot-check.
5. **CI lets `base/*/*` go straight into `base-qa`**, skipping the sandbox, and the bypass branch passes any PR. Both rely on discipline.
6. **No tags; versions are image SHAs.** "Which ticket is on which environment" is answered only by inspecting branches.
7. **About 3,000 branches per repo**, including clones and backups. Merged ticket and resolve branches are not deleted.

## 11. Improvement ideas (no change to how QA tests on gcet-qa / gutech-qa)

- **Equivalence check for resolve branches:** `git range-diff` or a `patch-id` comparison against the ticket branch, posted on the PR.
- **Branch-name validation** in `pr-validation.yml`: line, type, Jira key, and the resolve suffix.
- **Cross-line propagation report:** per Jira key, which of `base-qa`/`gcet-qa`/`gutech-qa`/`base-development` contain it (by `patch-id`), flagging tickets stuck between stages.
- **Auto-delete** merged ticket and resolve branches.
- **Tags** (or a release manifest) on each GitOps prod promotion.
- **A revert convention**, so reverts are traceable to the Jira key instead of `revert-NNNN-…`.

## Refreshing this analysis

This needs read access only. Blobless clones keep it light.

```bash
git clone --bare --filter=blob:none https://github.com/pbsgears/<repo>.git
# per long-lived target branch T:
git log --first-parent --merges --since=<start> --format="T|%cI|%an|%s" T
```

Then group the results by the source branch named in the merge subject. Limit the window to the last two months, and update the `git-workflow` skill if practice has changed.
