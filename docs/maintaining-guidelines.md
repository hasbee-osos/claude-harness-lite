# Maintaining the team guidelines

The harness agents read the team's development guidelines on **every ticket**. The Designer must name the conventions that apply, the Implementor follows them, and the Evaluator treats an unjustified breach as a blocking finding. So a rule that is wrong, missing or out of date here produces wrong code on every ticket that touches it.

## Where the guidelines live

| File | Contains |
|---|---|
| `skills/engineering-standards/references/sis-development-guidelines.md` | **The team's own conventions** — database and Liquibase, base entity/service/DTO classes, authorization, deletion and usage checks, common frontend components, error handling, dates, logging, notification templates, business config, code hygiene |
| `skills/engineering-standards/references/images/` | Screenshots referenced by that file |
| `skills/springboot/references/java-code-review-guidelines.md` | General Java review criteria (project rules above win where they differ) |
| `skills/*/references/archive/` | The original Word/PDF documents, frozen and superseded — never edited, never read by agents |

These Markdown files **are** the guidelines. There is no document to convert and nothing to keep in sync: the Word document and the PDFs were retired on 2026-09-16, because Claude Code cannot read binary files, and a converted copy silently drifts from its original.

## Changing a rule

1. Edit the Markdown file directly.
2. Keep **one rule per bullet**, in plain words, so an agent can quote it in a design or an evaluation. Write the rule out even when a screenshot shows it.
3. Adding a screenshot: put the PNG in `references/images/` with a descriptive name and link it from the bullet, in the form `([screenshot](images/NAME.png))`. The words carry the rule; the image only illustrates it.
4. Naming a file, class or method (e.g. `MasterBaseService`, `DateUtils.getEndOfDay`) makes the rule far more usable than a general statement.
5. Open a PR against this plugin repo. Everyone's harness picks the change up as soon as they update their copy of the plugin.

## After changing a rule

Nothing to regenerate. The next `/work` run reads the new text.

If you correct a rule because an agent got it wrong, say so in the PR: it usually means the rule was ambiguous, and the fix is clearer wording rather than more rules.
