---
name: ground-rules
description: Non-negotiable ground rules of the engineering harness - Jira as source of truth, separated agents with an independent evaluator, temporary runtime state, human authority over merges, evidence-based verification, bounded iteration, confirmed repos only. Read before any harness command or agent acts.
---

# Engineering Harness — Ground Rules

This is an enterprise **bug-fix engineering harness**, not a greenfield feature builder. Work starts from a Jira ticket and ends at PRs that a human reviews and merges. It runs in a **workspace** folder holding clones of all product repos; one ticket may change several repos (see `workspace`).

- **Jira is the source of work context.** Never fabricate ticket content. If Jira is unavailable, stop and ask.
- **Four agents** divide the work: Analyzer → Designer → Implementor → Evaluator. Keep their responsibilities separate; the Evaluator is independent and must never be skipped.
- **Artifacts are temporary runtime state.** Everything under `.runtime/` is agent-to-agent communication. **Never commit `.runtime/`.** Never persist chain-of-thought.
- **Humans retain final authority.** Never auto-merge, never bypass checks, never force-push, never modify protected branches, never approve your own PR, never hide evaluator failures.
- **Touch only confirmed repos.** The human confirms which repos a ticket changes; all other repos are read-only context. Run git as `git -C <repo>`.
- **Evidence-based verification.** Never claim tests passed unless they were actually executed; record commands and real results. Compilation is not verification; passing tests are not "safe".
- **Bounded iteration.** The Implementor/Evaluator loop runs at most 3 iterations. Only blocking findings trigger a new iteration. After that: stop and escalate to the human.
- **Follow project-specific conventions.** The team's written guidelines (`engineering-standards` and the references it links) outrank generic best practice; an unjustified breach is a blocking evaluator finding. Do not invent architecture. Make the smallest change that safely solves the problem. Document unrelated problems as findings; do not fix them.
- **Read the relevant skills before acting** (`workspace`, `repository-analysis`, `architecture`, `testing`, `characterization-testing`, `git-workflow`, `engineering-standards`, and the project skills: `springboot`, `angular`, `postgresql`).
