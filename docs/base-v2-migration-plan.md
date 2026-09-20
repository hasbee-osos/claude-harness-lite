# base-v2 — Single Trunk Migration: Actionable Plan

Companion to [`branching-analysis.md`](../skills/git-workflow/references/branching-analysis.md), the evidence base; every number below is cited from it (window 2026-06-20 → 2026-09-20).

**Goal:** collapse the `base` / `gcet` / `gutech` / `otc` multi-line branching model into one development trunk (working name `base-v2`), seeded from `gcet-qa`, with customer differences handled by policy-driven configuration instead of per-customer branches.

**The cost being removed:** re-landing the same base ticket on another line is **35–36% of all developer-facing merges** (BE 376 of 1,067, FE 391 of 1,066). **37–44%** of sandbox PRs need a hand-resolved conflict branch that nothing verifies against the original ticket. Median latency `base-qa` → customer sandbox is 0.8 days, and → `base-development` another 4.2–5.5 days.

**Risk context:** there is no branch-based production release (none since 2025-12-21), but every customer product has staging and UAT databases and its own hotfix stream. GCET staging took 21 BE / 24 FE hotfix merges over 2026-06-24 → 2026-07-10. These are live environments with real data.

---

## Decisions taken (do not re-litigate)

| # | Decision | Reason |
|---|---|---|
| D-1 | `base-v2` is cut from **`gcet-qa`** | The only code any customer has validated. It is ahead of `base-development` by 4,524 commits (BE) / 3,917 (FE) and behind by 18 / 10. |
| D-2 | **Do not** rename or branch from `gcet-development` | Stale — 1 merge in 3 months (a back-merge, 2026-09-05). `gutech-development` has none. Its ladder was abandoned in the 2026-03-24 CI rework. |
| D-3 | **Reconcile only the `STT-15` gap**, not `base-development` as a whole | `base-development` is already inside the customer lines: 107/108 BE and 104/105 FE of its merges are contained in both `gcet-qa` and `gutech-qa`, carried there by wholesale merges on 2026-08-03, 2026-08-05 and 2026-09-07. The entire residual delta is `STT-15 section-group-merge-request` (18 commits BE / 10 FE). |
| D-4 | Base-only tickets are **an audit, not a gate** | The 39–46% of base tickets with no customer PR had their code carried onto `gcet-qa` and `gutech-qa` by those same wholesale merges. Worth knowing what is running unverified on customer QA; not a migration blocker. |
| D-5 | Tag before collapsing, instead of patch-id verifying | Neither repo has any tags; tagging every long-lived branch tip takes minutes and makes the whole migration reversible. |
| D-6 | **Do not** build the extension framework upfront | Speculative frameworks stall; let the first real customer requirement on the trunk force it into existence. |
| D-7 | The trunk **must provide release isolation** | Today a stabilisation stream is isolated by cloning a whole line — branch pair, CI merge path, new reusable deploy workflow and a deploy job in all 8 repos. Without a cheaper mechanism, the trunk gets cloned the first time a release must stop moving while feature work continues. |
| D-8 | The `osos-*` branches are **out of scope** | They are a temporary hardening line bound for UAT, to be discontinued. Do not migrate them and do not model the trunk on them — but tag them in Phase 0 and do not cut over while the sprint is in flight. |

---

## Phase 0 — Safety net (do first, before anything changes)

- [ ] **Tag the tip of every long-lived branch in all 8 repos**: `archive/<branch>-2026-09-20` for `base-development`, `base-qa`, `base-sandbox-qa`, `gcet-*`, `gutech-*`, `osos-*`, `otc-*`, `cbfs-*`, `saas-*`, `upgradebase-*`, and the live `pre-hotfix-*` branches. Push the tags. This is the rollback.
- [x] **Refresh `branching-analysis.md`** — done 2026-09-20.
- [ ] **Wait for the hardening sprint to ship.** The `osos-*` branches and `pre-hotfix-osos-staging-*` are live and kept current by merging `gcet-sandbox-qa` into them every few days. Cutting over after they are discontinued removes them from the migration's surface area entirely.

## Phase 1 — Size the work (analysis only, no branch changes)

- [ ] **Decide the fate of `STT-15 section-group-merge-request`** — the only content in `base-development` that is not on `gcet-qa` (18 commits BE / 10 FE, landed 2026-09-18).
- [ ] **Audit what the wholesale merges pushed onto customer QA.** The 2026-08-03/05 and 2026-09-07 merges moved base-only, never-customer-QA'd work onto `gcet-qa` and `gutech-qa`. The PO should see what is actually running.
- [ ] **Inventory the GUtech delta.** 43 BE / 52 FE distinct gutech-specific Jira keys in 3 months (47 / 55 distinct branches). Group by key and classify each into:
  - branding / labels / cosmetic → theme file
  - thresholds, toggles, optional fields → config table
  - genuinely different business rules → real extension point

  This classification determines whether "policy-driven" is weeks or months. **Do not commit to a date before it exists.**
- [ ] **Inventory the GCET delta.** 94 BE / 91 FE distinct gcet-specific keys — twice the GUtech volume. Seeding the trunk from `gcet-qa` makes GCET-specific behaviour the unmarked default that every other customer must be configured out of. Size it deliberately.
- [ ] **Find out why `upgradebase` is in the CI brand list** with no activity since 2025-12. It looks like a prior consolidation attempt; learn why it stopped.
- [ ] **Confirm OTC really matches GCET.** Near-zero branch activity (BE 1 merge 2026-07-31, FE last 2026-03-27), but still in `prod-release.yml` with `qa`/`staging`/`uat` databases. Dormant in git is not retired.

## Phase 2 — Lock the remaining decisions

- [ ] **Design the release-isolation mechanism (D-7).** The trunk needs an answer to "stabilise a release for UAT while feature work keeps landing" that is cheaper than cloning the line. Options: a short-lived release branch cut from the trunk, feature flags so unfinished work ships dark, or an environment pinned to a SHA while the trunk moves on.
- [ ] **Pick the trunk name.** CI cost is the same either way: `extract_brand` falls back to `base` for any prefix outside the brand list, so `base-v2` is treated as base, but `VALID_MERGE_PATHS` resolves `$SOURCE_BRAND-sandbox-qa` to `base-sandbox-qa`, so every trunk path needs an explicit rule whatever the name. Choose on meaning: `base-v2` keeps the word that carries the old "port from base" mindset; `main` / `develop` / `trunk` says there is nothing to port to. Name the env branches to match (`{trunk}-sandbox-qa`, `{trunk}-qa`) so CI and the harness guard work by pattern.
- [ ] **Schedule the cutover when the gcet line is level.** As of 2026-09-20 it is: `gcet-sandbox-qa` is fully contained in `gcet-qa`, as is `base-sandbox-qa` in `base-qa`.

## Phase 3 — Execute the cutover (all 8 repos in lockstep)

Repos: `sis-product-sis-admin-backend`, `sis-product-sis-frontend`, `sis-product-business-config-service-backend`, `sis-product-notification-handler-backend`, `sis-product-sis-attachment-handler-backend`, `sis-product-sis-scheduler-service`, `sis-product-workflow-engine-backend`, `sis-product-sis-keycloak`.

Lockstep is cheap: the six satellite services carry 0–7 merges in 3 months against 384–389 in the two main repos. Branches must still be created in all 8 (a `base-v2` frontend against a base backend is the failure mode to avoid), but only two repos carry real migration risk.

- [ ] Cut `{trunk}` from `gcet-qa` in **every** repo; create `{trunk}-sandbox-qa` and `{trunk}-qa` from it.
- [ ] **`pr-validation.yml`** — add the allowed merge paths explicitly: `base/*/*:{trunk}-sandbox-qa`, `{trunk}-sandbox-qa:{trunk}-qa`, `pre-hotfix-*:{trunk}-sandbox-qa`, `revert-*:{trunk}-sandbox-qa`. Until this lands, **every PR into the new trunk fails validation**. Budget for iteration: standing up one line on 2026-09-18 took three commits in a day to get a single path right.
- [ ] **Deploy trigger** — not a one-line edit to the canonical template. Expect a **new reusable workflow** (as `build-deploy-osos-qa-workflow.yml` was) *and* a new job in each repo's own `all-deploy-workflow.yml`.
- [ ] **Re-point the SonarQube quality gate**, currently on PRs into `base-sandbox-qa` (moved there from `gcet-qa` on 2026-09-14 — it has already moved twice, so make this move deliberate).
- [ ] **Re-point image promotion.** `copy-gcet-qa-images-to-osos.yml` hard-codes `gcet-qa → osos-qa → osos-staging`; retire or re-source it, and confirm what feeds GCET's own staging/UAT.
- [ ] **Define the hotfix path on the trunk.** Decide whether `{line}/hotfix/* → pre-hotfix-*` becomes trunk-based, SHA-based, or attaches to the D-7 release branch.
- [ ] Freeze the retired lines (announce, then stop accepting PRs). Tags from Phase 0 preserve them.

## Phase 4 — Harness changes (`claude-harness-lite`)

The skill already routes on the Jira **Customer Name** field and stops at one PR per repo, so the multi-stage model is gone. What the cutover still needs:

- [ ] **Add the trunk and its env branches to the `protected-branches` block** in `skills/git-workflow/SKILL.md`. `hooks/scripts/git-guard.js` parses that block directly, and `base-v2` matches none of the existing patterns — without this, agents can commit straight to the new trunk on day one. Re-run `node hooks/scripts/git-guard.selftest.js` after editing it.
- [ ] **Collapse the routing table to one row.** Customer Name stops deciding the branch: every ticket cuts from `{trunk}` and targets `{trunk}-sandbox-qa`. Keep the empty-value stop only if Customer Name still gates anything else.
- [ ] **Simplify branch naming** to `{type}/{JIRA-ID}-{desc}` once there is no line to disambiguate, or keep a single `{trunk}/` prefix if CI needs it.
- [ ] Keep the resolve-branch section — a single trunk still has one fast-moving sandbox, so concurrent-merge conflicts do not go away.
- [ ] Mark `branching-analysis.md` as historical evidence for the pre-migration model, and keep it — the deviations section explains why several rules exist.

## Phase 5 — Customization, after the trunk is live

- [ ] Keep GUtech on its own branch **temporarily**; do not strand in-flight GUtech work at cutover.
- [ ] Build the extension mechanism when the **first** customer requirement lands on the trunk that configuration cannot express. That requirement defines the mechanism; a speculative framework will not fit it.
- [ ] Migrate the Phase 1 GUtech and GCET inventories into config/theming incrementally, highest-frequency first.

---

## Open questions

1. How does the trunk isolate a release? (D-7 / Phase 2.)
2. Trunk name — `base-v2` vs `main` / `develop` / `trunk`.
3. GUtech and GCET delta classification — theming, config, or a real extension framework.
4. Fate of `STT-15 section-group-merge-request`.
5. Where hotfixes live after the cutover, given live staging environments.
6. Why `upgradebase` exists and stalled.

## Verification commands (re-run before acting)

```bash
R=sis-product-sis-admin-backend

# 1. base-development contained in gcet-qa — expect ~18 / ~4500
git -C $R rev-list --count origin/gcet-qa..origin/base-development
git -C $R rev-list --count origin/base-development..origin/gcet-qa

# 2. Per-merge containment — expect ~107 of 108
git -C $R log --first-parent --merges --since=2026-06-20 --format=%H origin/base-development |
  while read h; do git -C $R merge-base --is-ancestor $h origin/gcet-qa && echo IN; done | wc -l

# 3. Is the gcet line level (cutover precondition)? — expect "<n>  0"
git -C $R rev-list --left-right --count origin/gcet-qa...origin/gcet-sandbox-qa

# 4. Has the hardening sprint ended? (osos-* removed, or far ahead of gcet)
git -C $R rev-list --count origin/gcet-sandbox-qa..origin/osos-sandbox-qa

# 5. Customer-specific delta by ticket
git -C $R log --first-parent --merges --since=2026-06-20 --format=%s origin/gutech-sandbox-qa |
  grep -oiE 'gutech/[a-z]+/(gsis|stt)-[0-9]+' | grep -oiE '(gsis|stt)-[0-9]+' | sort -u
```
