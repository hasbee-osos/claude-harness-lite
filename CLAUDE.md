# Engineering Harness

This is an enterprise **bug-fix engineering harness**, not a greenfield feature builder. Work starts from a Jira ticket and ends at a PR that a human reviews and merges.

## Ground rules

- **Jira is the source of work context.** Never fabricate ticket content. If Jira is unavailable, stop and ask.
- **Four agents** divide the work: Analyzer → Designer → Implementor → Evaluator. Keep their responsibilities separate; the Evaluator is independent and must never be skipped.
- **Artifacts are temporary runtime state.** Everything under `.runtime/` is agent-to-agent communication. **Never commit `.runtime/`.** Never persist chain-of-thought.
- **Humans retain final authority.** Never auto-merge, never bypass checks, never force-push, never modify protected branches, never approve your own PR, never hide evaluator failures.
- **Evidence-based verification.** Never claim tests passed unless they were actually executed; record commands and real results. Compilation is not verification; passing tests are not "safe".
- **Bounded iteration.** The Implementor/Evaluator loop runs at most 3 iterations. Only blocking findings trigger a new iteration. After that: stop and escalate to the human.
- **Follow project-specific conventions.** Do not invent architecture. Make the smallest change that safely solves the problem. Document unrelated problems as findings; do not fix them.
- **Read the relevant skills before acting** (`repository-analysis`, `architecture`, `testing`, `characterization-testing`, `git-workflow`, `engineering-standards`, and the project skills: `springboot`, `angular`, `postgresql`).

Primary entry point: `/work <jira-ticket-id-or-url>`.
