---
name: git-workflow
description: Safe Git workflow - branch safety, ticket-based branches, protected branch rules, commit discipline, diff inspection, no force-push, no auto-merge. Inspect repository state before acting. Use for all Git operations.
---

# Git Workflow

**Inspect the current repository state before acting** (`git status`, `git branch --show-current`).

## Workflow

```
main/master/development → feature/<ticket-id> → implementation → verification → PR → human review → human merge
```

## Rules

- Branch naming: `feature/<ticket-id>`. Never work directly on protected branches (main, master, develop, development, release/*) unless the human explicitly authorizes it.
- Before modifying files, confirm the working tree is clean of unrelated changes. Never overwrite, stash, or discard user changes without their direction.
- Commit discipline: small, focused, ticket-referencing commits; no secrets; no unrelated files.
- Inspect the final diff (`git diff`, `git diff --staged`) before finishing; ensure the change is scoped to the ticket.
- **Never**: force-push, auto-merge, bypass CI/checks, approve your own PR, rewrite history on shared branches.
- Destructive operations (`reset --hard`, `clean -f`, `branch -D`, `push --force`) require explicit human authorization.
