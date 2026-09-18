---
name: input-packets
description: When the plan stops on open questions, write a paste-ready Jira comment for the people who can answer them - qa-packet.md for bugs (QA), sme-packet.md for stories, tasks and features (subject-matter expert) - then read the answers back from Jira on resume. Use whenever a stage returns NEEDS_INPUT.
---

# Input packets

A ticket that stops on open questions is only unblocked when the right person answers them, and that person works in Jira, not in a terminal. So whenever the Planner returns `NEEDS_INPUT`, the orchestrator writes a **packet**: a short, paste-ready Jira comment the developer copies onto the ticket. The harness has read-only Jira access, so a human always does the posting.

## Which packet

| Jira issue type | Packet | Audience | Template |
|---|---|---|---|
| Bug | `qa-packet.md` | QA | `templates/qa-packet.md` |
| Story, Task, Improvement, New Feature | `sme-packet.md` | Subject-matter expert / product owner | `templates/sme-packet.md` |
| Sub-task | follow the parent's issue type | | |
| Anything else | ask the human which one | | |

## Writing it

The orchestrator writes it from the stage's **Open Questions**, after the artifact is saved and before stopping. No extra agent is needed.

1. **Sort the questions.** Only questions the audience can answer go in the packet.
   - QA can answer: behaviour, environments, retest results, expected results.
   - An SME can answer: business rules, scope, examples, priorities.
   - Questions only a developer can answer (a design choice, a library, a migration) stay in the terminal summary. If nothing is left for the audience, write no packet.
2. **Fill the template.** Keep its headings. The whole comment should take under two minutes to read.
3. **Write for the reader, not the codebase.**
   - Screen names, menu paths, roles and statuses. Never class names, file paths, commit hashes or SQL.
   - Refer to other tickets by key (GSIS-123), never by branch or commit.
   - Say in one clause why each question matters, so the answer is useful.
4. **Make every question answerable in one line:** Y/N, lettered options with an "other: ___", or a small table to fill in. Number the questions; the answers come back by number.
5. **Ask for evidence, not opinions** (bugs): the environment, the date and time of the test, which recipient or screen was checked, and a screenshot or recording if the result differs from expected.
6. **Never include:** personal data (names, emails, IDs, even from recordings), secrets, internal URLs with tokens, or chain-of-thought.

## Recording it

- Save it in the ticket folder as `qa-packet.md` or `sme-packet.md`. A later round of questions on the same ticket goes to `qa-packet-2.md` and so on; never overwrite.
- Record it with the stage that stopped, exactly as `brain` → "What each stage records" and "Input packets" say.
- Show the developer the path, and tell them to paste the file's content as a Jira comment. The template's Markdown (bold, lists, tables) converts on paste.

## Reading the answers (on resume)

When `/work` resumes a ticket whose `blocked_on` names a packet:

1. Read the ticket's comments (`listJiraIssueComments`) posted after the packet was committed, and any answers the developer pastes in the terminal.
2. Map each answer to its question number. Show the developer the mapping as a table: question, answer, who answered, and when.
   - An unanswered, unclear or contradictory answer is marked as such. It is never guessed.
3. **The developer confirms the mapping.** Then record **Answers received** (`brain`).
4. An answer that settles a choice becomes a decision record, citing the Jira comment as evidence. Examples: who receives a notification, what a business rule is, or that the defect no longer reproduces. If it reverses an earlier decision, supersede that decision.
5. Continue from the stage that stopped. Re-run that stage with the answers, writing its artifact as the next revision (`plan-2.md`). Never overwrite the earlier artifact.
6. If answers are missing, stop again. Show which questions are still open, and write no new packet unless the questions changed.

A bug that QA confirms no longer reproduces goes to the human to close. Record **Ticket closed** (`brain`) only when the human confirms.
