---
name: workspace
description: Multi-repository workspace model - how the harness finds the product repos under the session directory, runs git per repo, decides which repos a ticket touches, where runtime state lives, and the state.json schema. Use for every harness command and agent.
---

# Workspace

The harness runs in a **workspace**: a parent folder that holds clones of the product repos (7 Spring Boot services + the Angular UI). Claude is started in that folder. One ticket may change several repos.

```text
<workspace>/                 ← Claude session directory
├── .runtime/<ticket-id>/    ← harness state for the ticket (never inside a product repo)
├── claude_harness_lite/     ← the plugin (not a product repo)
├── sis-product-sis-admin-backend/
├── sis-product-sis-frontend/
└── …
```

## Finding the repos

- **Product repos** are the immediate subfolders of the session directory that contain `.git`. Skip any folder containing `.claude-plugin/` (the harness itself) and any folder that is not a git repo.
- **Single-repo mode:** if the session directory itself is a git repo, it is the workspace's only repo.
- Refer to repos by folder name (e.g. `sis-product-sis-frontend`). Cite code as `<repo>/<path>`.
- The branching strategy (`git-workflow`) is the same in every repo.

## Git in a workspace

- **Always run git as `git -C <repo> …`**, one command per repo, with a literal path. Never rely on `cd`, and never put a variable or subshell in the path. `git-guard` resolves the target repo from `-C`/`cd` and **denies write commands whose repo it cannot determine**.
- Fetch before analysis: `git -C <repo> fetch origin` for every repo (read-only locally).
- **Code of record** is `origin/<source_branch>`, not whatever happens to be checked out. If a repo's checkout differs from it for a file you rely on (`git -C <repo> diff --quiet HEAD origin/<source_branch> -- <path>` fails), read that file with `git -C <repo> show origin/<source_branch>:<path>`.
- Touch only the repos recorded in `state.json` `repos`. Other repos are read-only context. Never change their checkout, never stash or discard their changes.

## Which repos a ticket touches

1. The **Analyzer** traces the flow across repos (UI component → HTTP call → controller → service → repository/SQL, and service-to-service calls) and lists each involved repo as **change** or **context**, with evidence.
2. The **Designer** confirms the list, gives a change plan per repo, and names cross-repo contracts (API shape, DTO fields, error codes) that must stay consistent, plus any deploy/merge ordering between repos.
3. **The human confirms the repos to change** before any branch is created. Only then are ticket branches created — one per changed repo, all with the **same branch name**.

## Runtime state

- Location: `<workspace>/.runtime/<ticket-id>/`. Before writing there, confirm it cannot be committed: if the workspace folder is itself inside a git repo, `git check-ignore -q .runtime` must succeed — otherwise stop and ask the human to ignore it.
- Never commit `.runtime/`. Never store chain-of-thought.

### `state.json` schema

```json
{
  "ticket": "GSIS-12345",
  "status": "ANALYZING | DESIGNING | AWAITING_REPO_CONFIRMATION | IMPLEMENTING | EVALUATING | PR_STAGE_1 | PR_STAGE_2 | DONE | NEEDS_INPUT | ESCALATED",
  "iteration": 1,
  "max_iterations": 3,
  "workspace": "C:/sis-workspace",
  "flow": "A",
  "source_branch": "base-development",
  "branch": "base/bugfix/GSIS-12345-short-desc",
  "repos": {
    "sis-product-sis-admin-backend": { "role": "change", "branch_created": true },
    "sis-product-sis-frontend":      { "role": "change", "branch_created": true }
  },
  "context_repos": ["sis-product-sis-student-service"],
  "pr_targets": [
    { "stage": 1, "targets": ["base-sandbox-qa"], "status": "OPEN" },
    { "stage": 2, "targets": ["gcet-sandbox-qa", "gutech-sandbox-qa"], "status": "PENDING" }
  ],
  "prs": [
    {
      "repo": "sis-product-sis-frontend",
      "stage": 1,
      "target": "base-sandbox-qa",
      "head": "base/bugfix/GSIS-12345-short-desc",
      "resolve_branch": null,
      "compare_link": "https://github.com/pbsgears/sis-product-sis-frontend/compare/…",
      "url": null
    }
  ],
  "analysis": "READY | NEEDS_INPUT",
  "design": "READY | NEEDS_INPUT",
  "implementation": "COMPLETE | BLOCKED",
  "evaluation": "PASS | FAIL | INSUFFICIENT_EVIDENCE"
}
```

- `flow`, `source_branch`, `branch` and `pr_targets` follow `git-workflow` and are the same for every changed repo.
- A stage is done only when **every** changed repo's PRs for that stage are merged and the human confirms verification.
