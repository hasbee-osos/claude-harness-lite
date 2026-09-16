---
name: ground-rules
description: Non-negotiable ground rules of the engineering harness - Jira as source of truth, separated agents with an independent evaluator, a durable brain of locked decisions, human authority over merges, evidence-based verification, bounded iteration, confirmed repos only. Read before any harness command or agent acts.
---

# Engineering Harness — Ground Rules

This is an enterprise **bug-fix engineering harness**, not a greenfield feature builder. Work starts from a Jira ticket and ends at PRs that a human reviews and merges. It runs in a **workspace** folder holding clones of all product repos; one ticket may change several repos (see `workspace`).

- **Jira is the source of work context.** Never fabricate ticket content. If Jira is unavailable, stop and ask. Attachments are part of that context: screen recordings and screenshots are read on every ticket that has them (`jira-attachments`), and an attachment that could not be read is recorded as a gap, never silently skipped. They stay on the local machine.
- **Four agents** divide the work: Analyzer → Designer → Implementor → Evaluator. Keep their responsibilities separate; the Evaluator is independent and must never be skipped.
- **The brain is the durable record.** Every run writes its state, journal, decisions and artifacts to `<workspace>/sis-brain/tickets/<ticket>/` (see `brain`), so any later session can resume the ticket and any reader can see why the fix was built this way. Iteration artifacts are numbered, never overwritten. Never write chain-of-thought, secrets or bulk file dumps there, and never commit the brain into a product repo.
- **Decisions are locked and citable.** Flow, repos, root cause, fix approach, test strategy, convention deviations and the evaluator verdict each become a numbered decision record with its justification and evidence. Later stages cite the ID; changing course requires a new record that supersedes the old one. Contradicting a locked decision without superseding it is a blocking evaluator finding.
- **Humans retain final authority.** Never auto-merge, never bypass checks, never force-push, never modify protected branches, never approve your own PR, never hide evaluator failures.
- **Touch only confirmed repos.** The human confirms which repos a ticket changes; all other repos are read-only context. Run git as `git -C <repo>`.
- **Evidence-based verification.** Never claim tests passed unless they were actually executed; record commands and real results. Compilation is not verification; passing tests are not "safe".
- **Bounded iteration.** The Implementor/Evaluator loop runs at most 3 iterations. Only blocking findings trigger a new iteration. After that: stop and escalate to the human.
- **Follow project-specific conventions.** The team's written guidelines (`engineering-standards` and the references it links) outrank generic best practice; an unjustified breach is a blocking evaluator finding. Do not invent architecture. Make the smallest change that safely solves the problem. Document unrelated problems as findings; do not fix them.
- **Read the relevant skills before acting** (`workspace`, `brain`, `jira-attachments`, `repository-analysis`, `architecture`, `testing`, `characterization-testing`, `git-workflow`, `engineering-standards`, and the project skills: `springboot`, `angular`, `postgresql`).
