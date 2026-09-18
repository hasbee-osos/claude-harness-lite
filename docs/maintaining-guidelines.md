# Maintaining the team guidelines

The harness agents read the team's development guidelines on **every ticket**, for each stack the ticket touches. The guidelines are not complete and grow continuously. The Planner must name the conventions that apply, the Implementor follows them, and the Evaluator treats an unjustified breach as a blocking finding. So a rule that is wrong, missing or out of date here produces wrong code on every ticket that touches it.

## Where the guidelines live

| File | Contains |
|---|---|
| `skills/engineering-standards/SKILL.md` | Rules for **every** stack — GMT+0 dates, code hygiene — plus the change principles and testing standard |
| `skills/engineering-standards/references/backend.md` | Spring Boot conventions — base entity/service/DTO classes, injection, authorization, deletion and usage checks, error handling, logging, notification templates, business config, scheduler |
| `skills/engineering-standards/references/frontend.md` | Angular conventions — common components, parent/child and expandable tables, bulk save/delete, dialogs, toggles, policy values |
| `skills/engineering-standards/references/database.md` | Database conventions — table naming and mandatory columns, Liquibase folders, numbering, FK guards, column types, config-service changelogs |
| `skills/engineering-standards/references/java-code-review.md` | General Java review criteria (the project rules above win where they differ) |
| `skills/engineering-standards/references/images/` | Screenshots referenced by those files |
| `skills/engineering-standards/references/archive/` | The original Word/PDF documents, frozen and superseded — never edited, never read by agents |

These Markdown files **are** the guidelines. There is no document to convert and nothing to keep in sync: the Word document and the PDFs were retired on 2026-09-16, because Claude Code cannot read binary files, and a converted copy silently drifts from its original.

## Changing a rule

1. Edit the Markdown file for the stack the rule belongs to. A rule that applies to backend and frontend alike goes in `SKILL.md`; otherwise keep it in one stack file — never write the same rule in two places. Agents read only the files for the stacks a change touches, so a rule in the wrong file is missed.
2. Keep **one rule per bullet**, in plain words, so an agent can quote it in a plan or an evaluation. Write the rule out even when a screenshot shows it.
3. Adding a screenshot: put the PNG in `references/images/` with a descriptive name and link it from the bullet, in the form `([screenshot](images/NAME.png))`. The words carry the rule; the image only illustrates it.
4. Naming a file, class or method (e.g. `MasterBaseService`, `DateUtils.getEndOfDay`) makes the rule far more usable than a general statement.
5. Open a PR against this plugin repo. Everyone's harness picks the change up as soon as they update their copy of the plugin.

## After changing a rule

Nothing to regenerate. The next `/work` run reads the new text.

If you correct a rule because an agent got it wrong, say so in the PR: it usually means the rule was ambiguous, and the fix is clearer wording rather than more rules.
