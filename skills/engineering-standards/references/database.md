# Database conventions (PostgreSQL and Liquibase)

**This file is part of the team's guidelines** — conventions for schema, SQL and Liquibase scripts. Edit it directly: one rule per bullet, stated in words even when a screenshot shows it. See `docs/maintaining-guidelines.md`. Rules for every stack (dates, code hygiene) are in the `engineering-standards` skill itself.

These are **project conventions**. A change that ignores them is wrong even if it compiles and its tests pass.

## Database and Liquibase

- Table names start with a module prefix: `sis_admin_`, `sis_student_`, `sis_exam_`, `sis_timetable_`, then `word2_word3` (e.g. `sis_admin_semester`, `sis_exam_grading_schema_config`).
- Every table has: `id`, `structure_master` (FK to `sis_admin_structure_master`), `active_status`, `created_at`, `updated_at`, `tenant_id`, `deleted`.
- **Every database modification needs a new Liquibase script. Hibernate auto-update is never used.**
- Foreign keys use a `preConditions`/`sqlCheck` guard on `pg_constraint` (checking `conname LIKE 'fk_<table>_on_<column>%'`) with `onFail="MARK_RAN" onError="MARK_RAN"`, then `addForeignKeyConstraint` named `fk_<table>_on_<column>`.
- Liquibase folder structure ([screenshot](images/liquibase-folder-structure.png)): under `V2`, the folders are `1-table_modifications`, `2-headers`, `3-navigations`. Table creations, modifications **and insertions** all go in `1-table_modifications`. Do not mirror the module structure inside. Files are picked up automatically — never register them anywhere, and never put "changelog" in a file name.
- Script numbering: the next available number, exactly 6 digits, then a description — e.g. `000002-evaluation-criteria-navigation.xml`.
- Column types: `VARCHAR(255)` for most text and for enums; `VARCHAR(1000)` for descriptions and remarks; `TEXT` (or `VARCHAR(10000)`+) for rich-text editor content; `double precision` for floats; copy `id` definitions from an existing script. Column length is mostly not restricted in the DB — validate on the frontend instead (titles: 255 in FE).
- Ask the PO for character limits on titles and other fields, and update the header Liquibase script accordingly.
- If code generation is automatic, add an entry to the Document code master.
- Lists (semesters, programs, main exams) always get a Liquibase-created table; follow how main exam was done.

## Config service changelogs

- Config service changelog layout ([screenshot](images/config-service-changelog-structure.png)), under `resources/db.changelog` with `db.changelog-master.xml` alongside: `1-table_modifications`, `2-insert_data_policy_type`, `3-insert_data_app_module`, and `4-insert_data_policy_configs` split by module (`01-administration`, `02-admission`, `03-finance`, `04-student`, `05-faculty`, `06-timetable`, `07-examination`).
- Set `sort_order` on `bc_config_template_field` rows so fields appear in the intended order in the frontend list view (1 = first column).
