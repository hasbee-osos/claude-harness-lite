---
name: input-packets
description: Questions to QA or an SME are a last resort. The bar a question must pass before it leaves the terminal, what to do instead (search, assume and record, ask the developer), and - only when the bar is met - how to write one very short paste-ready Jira comment (qa-packet.md for bugs, sme-packet.md for stories, tasks and features) and read the answers back. Use whenever analysis or design has an open question.
---

# Input packets — the last resort

Every packet is a round trip between teams: a developer posts it, someone else answers days later, and the ticket waits. The team cannot afford many of those. So the harness **works out what it can on its own, assumes what it safely can, asks the developer what the developer can answer, and sends a packet only for what is left** — once per ticket, and short.

## The bar: a question goes to QA or an SME only if all four hold

1. **It blocks.** Different answers lead to a different fix or build, or to not building at all. A question whose answer would not change the code, the tests or the decision to proceed is not asked.
2. **It is not findable.** Every source in "Look first" below was checked, and the analysis records where.
3. **It cannot be safely assumed.** Nothing settles it: not the product's behaviour today, not the same feature elsewhere in the product, not the ticket's wording, not a team convention — **or** a wrong guess would be costly to undo: data changed or migrated, messages sent to real users, permissions or security, grades, fees or other money.
4. **Only that audience can answer it.** A developer cannot (developer questions are asked in the terminal, where the developer already is), and the agent cannot check it itself.

A question that fails any of the four is **not** sent:

- **Findable** → find it.
- **Assumable** → record it as a decision (`Assumption: …`, with its basis and what would be affected if it is wrong), set it `LOCKED`, and continue. Assumptions are listed in the PR description under "Assumptions to verify", so QA checks them in the normal review of the change — no extra round trip.
- **Developer-answerable** → ask the developer in the terminal now, record the answer with `human_confirmed`, and continue.
- **Not blocking** → drop it.

## Look first

Before any question is considered, search:

- **The ticket:** description, every comment, attachments and screen recordings (`jira-attachments`).
- **Around the ticket:** linked issues and remote links; the parent and epic; related tickets found with JQL — the same epic, the same screen or notification name, recently resolved bugs in the same area — and their comments.
- **The code at `origin/<source_branch>`:** what the product does today is the expected behaviour unless the ticket says otherwise. Existing tests encode expected behaviour. Git history shows why code changed (`git -C <repo> log -S`, commits citing ticket keys). Liquibase and seed data, notification templates and configuration hold business rules too.
- **The same thing elsewhere:** how a sibling screen, workflow or notification already behaves is the convention to follow.

## Special cases that are not packets

- **A bug already fixed on the source branch** (the root cause is gone in `origin/<source_branch>`) needs no questions. Stop with the evidence and let the developer hand the ticket to QA for verification in the normal way.
- **Draft acceptance criteria** (feature): show them to the developer in the terminal with each criterion's basis, and lock them once confirmed. Only a criterion with two reasonable readings that pass the bar goes to the SME.
- **A story too big for one run** (`work-types`): the developer decides the slicing or the override in the terminal. It is a delivery decision, not a business rule.

## One round, at most three questions

- **The Analyzer collects every people-question the ticket will need, design included,** so design does not open a second round. The Designer raises a packet only for a new blocker that could not be seen at analysis, and it must pass the bar.
- **At most 3 questions.** If more than 3 pass the bar, the ticket is under-specified: stop and tell the developer, who decides whether to talk to the reporter or product owner directly or send the packet anyway.
- **One packet per ticket.** A second one is written only if the answers contradict each other or reveal a new blocker, and only after the developer agrees.

## Which packet

| Jira issue type | Packet | Audience | Template |
|---|---|---|---|
| Bug | `qa-packet.md` | QA | `templates/qa-packet.md` |
| Story, Task, Improvement, New Feature | `sme-packet.md` | Subject-matter expert / product owner | `templates/sme-packet.md` |
| Sub-task | follow the parent's issue type | | |
| Anything else | ask the developer which one | | |

## Writing it — short

The orchestrator writes it after the stage's artifact is saved and before stopping. No extra agent is needed.

- **Readable in under a minute:** at most about 120 words, not counting the option lists. One line of context, the numbered questions, one reply line. No summary sections, no restated ticket, no analysis.
- **Every question answerable in one line:** Y/N, or lettered options ending in "other: ___". Mark the option the harness will build if the answer is simply "OK".
- **Say why in ten words or fewer** per question.
- **Plain language for the reader:** screen names, menu paths, roles and statuses. Never class names, file paths, commit hashes or SQL. Refer to other tickets by key (GSIS-123).
- **Bugs:** ask for a retest result only when it is one of the questions, with the environment and the time of the test.
- **Never include:** personal data (names, emails, IDs, even from recordings), secrets, internal URLs with tokens, or chain-of-thought.

## Recording it

- Save it in the ticket folder as `qa-packet.md` or `sme-packet.md` (`-2` only for an agreed second round; never overwrite).
- Record it with the stage that stopped, exactly as `brain` → "What each stage records" and "Input packets" say.
- Show the developer the path, and tell them to paste the file's content as a Jira comment. The template's Markdown converts on paste.

## Reading the answers (on resume)

When `/work` resumes a ticket whose `blocked_on` names a packet:

1. Read the ticket's comments (`listJiraIssueComments`) posted after the packet was committed, and any answers the developer pastes in the terminal.
2. Map each answer to its question number and show the developer the mapping: question, answer, who answered, and when. An unanswered, unclear or contradictory answer is marked as such, never guessed. "OK" means the marked option.
3. **The developer confirms the mapping.** Then record **Answers received** (`brain`).
4. An answer that settles a choice becomes a decision record, citing the Jira comment as evidence. If it reverses an earlier decision or assumption, supersede it.
5. Continue from the stage that stopped. Re-run that stage with the answers, writing its artifact as the next revision (`analysis-2.md`). Never overwrite the earlier artifact.
6. If answers are missing, tell the developer which ones and stop. Do not write a new packet for the same questions; chasing an answer is the developer's call.

A bug that QA confirms no longer reproduces goes to the developer to close. Record **Ticket closed** (`brain`) only when the developer confirms.
