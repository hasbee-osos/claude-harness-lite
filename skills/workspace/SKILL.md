---
name: workspace
description: Multi-repository workspace model - how the harness finds the product repos under the session directory, runs git per repo, decides which repos a ticket touches, and where the brain records the run. Use for every harness command and agent.
---

# Workspace

The harness runs in a **workspace**: a parent folder that holds clones of the product repos (7 Spring Boot services + the Angular UI). Claude is started in that folder. One ticket may change several repos.

```text
<workspace>/                 ← Claude session directory
├── .brain/                  ← the brain: one folder per ticket (never inside a product repo)
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

## The brain

Every harness run records its state, decisions and artifacts in `<workspace>/.brain/` — one folder per ticket, durable across sessions. The layout, the `state.json` schema, the journal event vocabulary, the decision-record rules and the resume protocol all live in the **`brain`** skill. Read it before writing anything there.

Two things matter here in the workspace:

- The brain sits at the **workspace root**, beside the repo clones — never inside a product repo. If the workspace folder is itself a git repo, `git check-ignore -q .brain` must succeed before writing; otherwise stop and ask the human to ignore it.
- `state.json` `repos` is the list of repos this ticket may change. Every other repo is read-only context.
