---
description: Verify a deployed fix or feature in Chrome on a QA environment - developers on base-qa, QA on gcet-qa / gutech-qa - and produce a pre-screen verdict with evidence for QA sign-off
argument-hint: <jira-ticket-id-or-url> [--env base-qa|gcet-qa|gutech-qa]
allowed-tools: Task, Read, Write, Edit, Glob, Grep, Bash
---

# /verify — AI pre-screen of a deployed ticket

Input: `$ARGUMENTS` — a Jira key or URL, and optionally `--env <environment>`. Read the `qa-verify` skill first; it holds the script format, the deployment check, the allowlist and the verdict rules. The same command serves a developer after promotion to `base-qa` and QA after the port reaches `gcet-qa` or `gutech-qa`.

The browser run happens in the `engineering-harness:tester` agent so that screenshots and page reads never enter this session. This session does only the cheap steps.

1. **Ticket and environment.**
   - Read the issue through the Jira MCP: summary, description, acceptance criteria, Customer Name, comments, PR links. If Jira is unavailable, stop.
   - Environment: `--env`, else `<line>-qa` from Customer Name (`git-workflow`). It must be in `qa-verify/environments.md` with its entries filled; otherwise stop and say which values QA must supply.
   - Ask in one line whether the person is a **developer** or **QA**, unless they said so.
   - `git -C sis-brain pull --rebase` if the brain is in the workspace.
2. **Script.**
   - If `sis-brain/verify/<KEY>/script.md` exists, show it with any `Env notes` for this environment.
   - Otherwise write it (`qa-verify` → The test script) from the ticket, its attachments and recording (`jira-attachments`), and `sis-brain/tickets/<KEY>/` when the harness worked it (plan, `decisions.md`, `blast.json`).
   - **Wait for one confirmation**; apply any edits. Save `script.md`.
3. **Deployment check** (`qa-verify` → Deployment check) for each changed repo. On failure, write `runs.jsonl` with verdict `NOT_DEPLOYED`, tell the person what is missing, and stop. No browser.
4. **Tester.** Remind the person to have the "SIS QA verify" Chrome profile open and connected (`/chrome`), then dispatch `engineering-harness:tester` with the key, run number `<n>` (next free), the environment entry, the script, the role (developer or QA) and the output folder `sis-brain/verify/<KEY>/`. If the Chrome tools are not available to the agent, say so and stop; do not run the browser in this session.
5. **Report.**
   - Show the tester's summary as returned.
   - Write `verify-<n>-jira-comment.md` (`qa-verify` → The Jira comment) and append `runs.jsonl`.
   - Commit and push the brain: `<KEY>: verified on <env> - <VERDICT>`.
   - Give the path of the comment for the person to paste on the ticket; the harness is read-only in Jira.
   - Next step in one line: developer PASS → the port can go ahead; QA PASS → QA reviews the evidence and signs off; FAIL → evidence for the developer (`/work <KEY>` to reopen); INCONCLUSIVE → what a person needs to check by hand.
