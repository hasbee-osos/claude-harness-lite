---
name: lessons
description: Turn a correction into something the next ticket benefits from - what counts as a lesson, how to classify it as product knowledge or a harness defect, when a stage reads the existing lessons, and the confirmation gate before one steers future work. Use when a packet answer, review comment, QA defect or blocking evaluator finding shows the run got something wrong.
---

# Lessons

A correction only changes future work if it is written down. Claude does not carry anything from one session to the next: a reviewer's explanation, a QA answer, an evaluator's finding — all of it is gone when the session ends unless it lands in a file the next run reads.

This skill is the judgement: **what is worth recording, how it is classified, and when it is read.** Where the files go, which journal event is appended and how it is committed is specified once, in `brain` → "What each stage records" (**Lesson recorded**). Follow that table for the writes.

Lessons live in the runtime repo, never in this plugin. The plugin is installed read-only in a developer's workspace and any edit to it would be lost at the next update, so a run records what it learned in the repo it can push, and the plugin changes only when a human turns a lesson into a pull request.

## When to record

Only at the moments a correction actually arrives:

| Moment | Journal event that precedes it | Typical correction |
|---|---|---|
| A packet answer contradicts what the plan assumed | `input_received` | The behaviour QA describes is not what the code was read to mean |
| The ticket comes back after hand-off | `ticket_reopened` (`review`, `qa_bug`) | A reviewer or QA found the change wrong, incomplete or in the wrong place |
| The Evaluator raises a blocking finding | `evaluation` | Caught in-house before any human spent time on it |

**One lesson per correction at most, and only when it would change a future run.** A typo, a one-off environment failure, or anything already covered by `engineering-standards` or the codebase notes is not a lesson. If the correction is a fact about *where code lives or how a repo builds*, it is a **Codebase map correction** and belongs in `codebase/<repo>.md` — not here.

Ask, in one line, before recording: *would a future ticket go wrong the same way if nobody read this?* If no, don't record it.

## How to classify

Every lesson is one of two kinds, and the kind decides who acts on it.

- **`product`** — something true about this product that the run misread: a business rule, a screen's real behaviour, a convention this team follows, a trap in an existing service. Future runs read these.
- **`harness`** — something about how the harness itself reasons: a stage that skipped evidence it should have read, an instruction that led the agent somewhere wrong, a gap in what an agent is told. These are **not** read back by runs. They accumulate for a maintainer to harvest into a pull request against this plugin, because changing the harness is a reviewed change, not something a ticket does to itself.

When a correction is both — the Planner misread a business rule *because* it never opened the linked ticket — record the product fact as `product` and the process gap as `harness`. Two short records beat one that neither side can act on.

## The confirmation gate

A lesson is recorded with `status: proposed` and **only a `confirmed` lesson is read by a later run.** One over-generalised rule silently steering every future plan does more damage than no lessons at all.

Confirm it in the moment the human is already engaged — they have just given the feedback — with one short question naming the lesson in a single sentence. If they agree, record it `confirmed`. If they don't answer, or the run is unattended, leave it `proposed`; it is still on file and can be confirmed later. Never ask twice for the same lesson.

A lesson that a later ticket disproves is set to `retired` with a line saying what disproved it. Lessons are corrected by superseding, never by deleting — the same discipline as a locked decision.

## What a lesson record contains

Keep it to a screen. Written for a colleague six months from now who has none of this context.

- **What the run believed** — the assumption, plainly, and which stage held it.
- **What is actually true** — the correction, in the words of whoever gave it.
- **How it surfaced** — packet answer, review comment, QA defect or evaluator finding, with the ticket it came from.
- **Evidence** — `<repo>/<path>:<line>`, the Jira comment, or the failing check. Never a file dump, never chain-of-thought.
- **Applies to** — the repos, the product area and the stage it should reach.

Use `templates/lesson.md`.

## When a stage reads lessons

Reading every lesson ever recorded would cost more each month and change nothing most of the time. Read selectively, always through the index:

- The **Planner** greps `lessons/index.jsonl` for `status: confirmed` and `kind: product` lessons whose `repos` or `area` match the ticket, and opens at most a handful — the ones whose one-line summary bears on this change. It is a hint, like the codebase map: read the lesson, then confirm it against the code before relying on it.
- The **Implementor** reads the lessons the plan cites, plus any tagged `stage: implement` for the repos it is changing.
- The **Evaluator** reads the lessons the plan cites, and treats a `confirmed` lesson contradicted without explanation the same way it treats a contradicted locked decision.

If the index is missing or empty, carry on silently. No stage ever waits on lessons.

## Harvesting harness lessons

`kind: harness` lessons are read by a maintainer working **in this plugin's own repository**, not by a ticket run. Read them, look for the same gap appearing across several tickets — one ticket's complaint is an anecdote — and change the agent instruction or skill that allowed it, as a normal pull request with a version bump. Note the lesson ids in the pull request so the trail from correction to fix stays visible, and set each harvested lesson to `retired` with the pull request as its reason.
