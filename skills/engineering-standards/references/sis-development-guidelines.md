# SIS Development Guidelines (team conventions)

**This file is the guidelines.** Edit it directly; there is no document to convert and nothing to keep in sync. It began as `SIS Development Guidelines Documentation.docx` (kept in `archive/` for history, superseded 2026-09-16), including the rules that were only visible in that document's screenshots.

The guidelines are **not complete and grow continuously** — add to them here. Keeping them in the repo is what lets the harness agents follow them: they are read on every ticket, so a wrong or missing rule here produces wrong code everywhere. See `docs/maintaining-guidelines.md`.

- One rule per bullet, so an agent can cite it.
- Screenshots live in `images/` and are linked from the relevant section. They illustrate a rule; the written bullet is what agents follow, so state the rule in words too.

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

## Entities, services and DTOs

- Entities extend `MasterEntity` (e.g. `public class Semester extends MasterEntity`).
- Services extend `MasterBaseService` and `AuditBaseService` with the entity, request, response and filter DTOs.
- Requests extend `BaseAssignedRequestDto`; responses extend `MasterResponseDto`; lookups extend `BaseLookupEntity`.
- **Exception:** lookups, types and similar do not extend the master entity/service — extend them only when the frontend has a list page or an add page where users enter data.
- Use the entity itself for lists (programs, semesters, main exams) — never the `StructureMaster` of that entity.
- Always use campus-based filtering via Structure Master, unless someone explicitly says not to.
- Use `StructureMaster` references for course selections and semesters, from the right source:
  - Courses: only from Student Management → Administration → **Course Pre-Reg Offerings** (`StructureMaster coursePreRegOfferingCourse`, `List<StructureMaster> coursePreRegOfferingCourses`). Never from Course Master or Course offering courses.
  - Semesters: only **AY Semesters** (`StructureMaster aySemester`, `List<StructureMaster> aySemesters`). Never `SemesterMaster` for new development.
- **Constructor injection only. No `@Autowired`.**
- Endpoints are plural; entities are singular.
- Enum vs lookup table: ask the PO/BA whether new values will be added later. Backend logic depending on the values, or no new values, means an **enum**. Titles like Professor/Teacher/Mr./Miss come from `sis_general_lookup`. Tell the lead before creating a new lookup table.
- Status fields need two extra columns, `<status>UpdatedBy` and `<status>UpdatedAt`, updated whenever the status changes (see `ApplicationServiceImpl`), and shown under the status in the list page table. The same pattern applies on view pages: a status chip in the page header with the update date and time directly beneath it — e.g. `Submitted` / `13/06/2023 10.14 Hrs` ([screenshot](images/status-with-updated-timestamp.png)) and `Accepted` / `7/18/2024 9:59:59 AM` ([screenshot](images/offer-letter-status-header.png)).
- Add every new page/table to the `com.ubs.sis.common.domain.enums.TableReadableName` enum, with the value exactly equal to the table name and the frontend placeholder from the language files, so delete errors read properly.
- Always update the module table's link column with your module link when you start a story.

## Authorization

- One controller per module: `@PreAuthorizeGrant(module = ModuleType.STUDENT, permission = PermissionType.CREATE)`, with the DB module name (`student`), link (`admin/student`) and code (`STUDENT`).
- Several controllers in one module: the **same** module type on every controller.
- Cross-module access (e.g. Student calling a Finance API) lists both: `@PreAuthorizeGrant(module = {ModuleType.FINANCE, ModuleType.STUDENT}, permission = PermissionType.CREATE)`.
- **Do not put `@PreAuthorizeGrant` on a List View API.**

## Deleting records and usage checks

- Deletion is restricted when an entity has child records.
- Foreign-key usages (direct and via structure master) are now checked automatically by the common master service — the old manual `sis_common_entity_map` approach is no longer needed.
- The check runs in `MasterBaseService.preDelete`. If a service impl overrides `preDelete`, **call `super` first** unless the feature is deliberately skipped. A service extending `BaseService` instead can call `MiscUtils.checkUsagesBeforeDelete` first in its own `preDelete`.
- Override `deleteCheckIgnoredTables()` to exclude tables where the child rows are created on the same page and are meaningless without the parent, or where an id is only a reference. It returns the table names ([screenshot](images/delete-check-ignored-tables.png)), e.g.

  ```java
  @Override
  public String[] deleteCheckIgnoredTables() {
      return new String[]{ "sis_faculty_member_department_and_designation",
                           "sis_faculty_member_academic_background" };
  }
  ```

- Overriding `preDelete` ([`MasterBaseService` case](images/pre-delete-super-first.png), [`BaseService` case](images/pre-delete-base-service.png)): call the inherited implementation **first**, then add the specific checks and throw `GearsException` with `GearsResponseStatus.DATA_REMOVING_ERROR` and a message naming the record.

  ```java
  @Override
  public void preDelete(AcademicCalendar entity) {
      AcademicCalendarMasterService.super.preDelete(entity);           // must be first
      int countOfAcademicEvent = academicCalendarEventRepository
              .countByAcademicCalendarId(entity.getStructureMaster().getId());
      if (countOfAcademicEvent != 0)
          throw new GearsException(GearsResponseStatus.DATA_REMOVING_ERROR,
                  String.format("Given academic calendar %s is using in academic event",
                          entity.getAcademicCalendarTitle()));
  }
  ```

  Where the service extends `BaseService` rather than `MasterBaseService`, call `MiscUtils.checkUsagesBeforeDelete(entity, new String[]{})` first, then `<Service>.super.preDelete(entity)`.
- `MiscUtils.getEntityUsages(entity, checkIgnoredTables)` returns readable placeholders for every place an entity is referenced. Use it in `preUpdateEntity` too, throwing `GearsException(GearsResponseStatus.RECORD_IN_USE_ERROR, "message.common.alreadyInUseErrorUpdate", errorMetaData)` with `usedInPlaces` in the metadata (preferred, for structured frontend handling) or the list form. The Angular `GearsAlertService` turns `RECORD_IN_USE_ERROR` into a translated message centrally; components can override `onDataUpdateError` for update flows.

## Frontend conventions

- **Always use the common FE and BE components** — tables, headers, side drawers, buttons, drag and drop. Never build a custom version of something common; if a common component is missing, create one. Discuss any change to a common component with the lead.
- Child tables use the common table component with inline edits. On a parent+child page the parent table shows **5** records per page and the child/details table **10** ([screenshot](images/parent-child-table-pagination.png)).
- Expandable/collapsible table: `src/@gears-commons/component/data-table-expandable-collapsable/…`; every frontend service must implement `getChildTableContextPath()`. Child rows arrive as each parent record's `expandableCollapsableChildDataList`. The list page gets **Expand All / Collapse All** buttons above the table ([screenshot](images/expandable-table-ui.png)), and each parent row expands into the child table inline ([screenshot](images/expandable-table-child-rows.png)). Component usage ([screenshot](images/expandable-table-component-inputs.png)):

  ```html
  <gears-data-table-expandable-collapsable class="mt-4"
      [dataSource]="dataList" [overriddenValues]="overriddenValues" [loading]="loading"
      [component]="component" [headers]="headers"
      [childTableHeaders]="childTableHeaders" [childTableComponent]="childTableComponent"
      [childTableModule]="childTableModule" [childTableDataSource]="childTableDataList"
      [(filter)]="filter" [paginationMetaData]="metaDataCoursePreRegisterOffer"
      [module]="studentModule" (filterChange)="onFilterChanged($event)"
      (actionPicked)="onActionPicked($event)" [breakPreLine]="false">
  </gears-data-table-expandable-collapsable>
  ```
- Multi-line headers: `src/@gears-commons/component/header/page-multi-line-header`.
- Inline edit bulk actions: `showDeleteBulkDialogForRecordList` (delete, in `BaseListViewPage.ts`) and `saveBulk()` (save-all, in `base-crud-service.ts`), with backend `POST /bulk` and `DELETE /bulk` endpoints (see `EvaluationType*`; soft delete in batch, permission-checked with `PreAuthorizeGrantService.checkPermission`). From those base classes ([`BaseListViewPage`](images/show-delete-bulk-dialog.png), [`BaseCrudService`](images/base-crud-service-bulk.png)):
  - `showDeleteBulkDialogForRecordList(selectedRows, filter?)` opens the shared delete dialog (`_gearsDialogService.openDeleteDialog(this.component)`), and only on `'confirmed'` removes unsaved rows (those without an id) from the list and calls `deleteBulk(idNotNullList, currentFilter)` for the saved ones.
  - `BaseCrudService.saveBulk(requestBody)` posts to `<apiBaseUrl>/<getContextPath()>/bulk` after `ObjectUtils.setContextIdsIntoRequestBody`, and `deleteBulk` sends `DELETE` to the same `/bulk` path with the id list as the body. Context ids are always set through `ObjectUtils`, never by hand.
- **Always show a delete confirmation dialog**, and a cancel confirmation dialog when cancelling an add form containing data.
- Booleans (Yes/No) use the active toggle switch. Add/View/Edit pages carry the active-status toggle in the header unless there is a specific reason not to.
- Show attachments whenever attachments are used.

## Error handling

Translatable backend errors:
1. Use `GearsResponseStatus.CUSTOM_MESSAGE_ERROR`.
2. Add the message to the language file under `error` and throw with its path: `throw new GearsException(GearsResponseStatus.CUSTOM_MESSAGE_ERROR, "admin.error.entityAssignToSomeStyPlans");`

## Dates and times

- Store all dates and datetimes in **GMT+0**. Convert for display on the device, and for emails convert to the campus time zone.
- Backend: `DateUtils.convertTimeBasedCampusTimeZone()`. Frontend: `DateTimeUtils.convertTimeBasedDeviceTimeZone()`.
- Date-range filters use `DateUtils.getStartOfDay(date)` and `DateUtils.getEndOfDay(date)` so full days are covered (`>= fromDate`, `<= toDate`).

## Logging

- Use `@Slf4j` (`lombok.extern.slf4j.Slf4j`) at class level for console logging.

## Notifications and templates

- New notification integrations use `NotificationService.sendNotifications(...)` (sample: `ApplicationServiceImpl` lines 501–514). The [sample](images/send-notifications-sample.png) has this call shape: build a `Map<String, String> placeholdersMap` (e.g. `applicant`, `applicationRefNumber`, `reviewStatus`, `remarks`), then

  ```java
  this.notificationService.sendNotifications(Process.APPLICATION, Event.APPLICATION_STATUS_UPDATE,
          placeholdersMap, List.of(application.getApplicant()),
          List.of(application.getApplicationBasicInformation().getEmail()),
          /* attachments */ null, /* sender */ null,
          this.authApplicationRepository.findByAppId("SIS-APP-001").get(0),
          application.getTenantId(), application.getStructureMaster().getEntityAssignmentId(),
          /* redirectUrl */ "/#/admission/manage/application/view/" + application.getId());
  ```
- A new notification template event requires a default (master) template row in `sis_notification_template_master`; a letter template event requires `sis_admin_letter_template_master`; link the two where a link exists. See `000610-create-notification-template-master-tables.xml`.

## Business config service

- Frontend reads policy values through `PolicyParameterService.getPolicyValueByCode`.
- Backend uses `businessConfigClient.readConfig(policy_code, module, null, null, null, tenant_id, university_assignment_id, campus_assignment_id)` (see `ApplicationAttachmentServiceImpl.getAttachmentList`).
- Config service changelog layout ([screenshot](images/config-service-changelog-structure.png)), under `resources/db.changelog` with `db.changelog-master.xml` alongside: `1-table_modifications`, `2-insert_data_policy_type`, `3-insert_data_app_module`, and `4-insert_data_policy_configs` split by module (`01-administration`, `02-admission`, `03-finance`, `04-student`, `05-faculty`, `06-timetable`, `07-examination`).
- Set `sort_order` on `bc_config_template_field` rows so fields appear in the intended order in the frontend list view (1 = first column).
- Inactive policy config is ignored wherever it would otherwise apply.

## Scheduler service

`https://github.com/pbsgears/sis-scheduler-service`, JDK 17. Uncomment the local `application.yml` values, add a `case` to the switch in `SisSchedularApplication.java` for a new job, rebuild the jar and run `java -jar sis-scheduler-0.0.1-SNAPSHOT.jar <parameter_name>`.

## Code hygiene

- **No commented-out code** in frontend or backend. No `console.log` in frontend code. No unwanted whitespace.
- Review your own PR as soon as it is created and push fixes before someone else reviews it.
