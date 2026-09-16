# The brain

This folder is written by the Claude Code engineering harness. It is the **record of every ticket the harness has worked on in this workspace** — what was done, what was decided, why, and what it cost.

Copy this file to `<workspace>/.brain/README.md` the first time the brain is created.

---

## What is in here

| Path | What it holds |
|---|---|
| `index.jsonl` | One line per ticket milestone — the quickest way to see recent work |
| `current.json` | Which ticket and stage is running right now |
| `tickets/<TICKET-ID>/state.json` | The resume point: status, iteration, branch, repos, PRs, and `next_action` |
| `tickets/<TICKET-ID>/journal.jsonl` | Append-only event log with timestamps |
| `tickets/<TICKET-ID>/decisions.md` | Every decision taken, with its justification and evidence |
| `tickets/<TICKET-ID>/*.md` | The analysis, design, per-iteration implementation reports and evaluations, PR descriptions |
| `tickets/<TICKET-ID>/metrics.json` | Tokens, durations and iteration counts for that ticket |
| `metrics/` | `runs.jsonl` and `harness.prom` for Prometheus/Grafana |

## How to use it

- **Reopened bug?** Read `tickets/<TICKET-ID>/decisions.md` first. It says why the fix was built the way it was, which alternatives were rejected, and on what evidence.
- **Picking up someone's half-finished ticket?** Run `/brain <TICKET-ID>` in a Claude session started in this workspace, or just read `state.json` — `next_action` says what happens next in plain words.
- **Listing recent work?** `/brain` with no argument, or `tail index.jsonl`.

## Rules

- **Nothing here is generated for show.** If a file says a test passed, that test was executed and the output is in the artifact.
- **Iteration history is never overwritten.** `evaluation-1.md` stays when iteration 2 writes `evaluation-2.md`.
- **The journal is append-only.** Corrections are appended, never edited in place.
- **No secrets, no chain-of-thought, no bulk file dumps, no personal data.** If you find any, delete it and tell the harness maintainers — a rule is missing.
- **This folder is not a product repo and must never be committed into one.**

## Deleting things

Safe to delete a whole `tickets/<TICKET-ID>/` folder once the ticket is closed and you no longer want the history — but that is exactly the history that stops a reopened bug being re-debugged from scratch. Prefer to keep it.
