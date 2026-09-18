# Backend conventions (Spring Boot)

**This file is part of the team's guidelines** — conventions for the Java services. Edit it directly: one rule per bullet, stated in words even when a screenshot shows it. See `docs/maintaining-guidelines.md`. Rules for every stack (dates, code hygiene) are in the `engineering-standards` skill itself.

These are **project conventions**. A change that ignores them is wrong even if it compiles and its tests pass.

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

## Error handling

Translatable backend errors:
1. Use `GearsResponseStatus.CUSTOM_MESSAGE_ERROR`.
2. Add the message to the language file under `error` and throw with its path: `throw new GearsException(GearsResponseStatus.CUSTOM_MESSAGE_ERROR, "admin.error.entityAssignToSomeStyPlans");`

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

- Backend uses `businessConfigClient.readConfig(policy_code, module, null, null, null, tenant_id, university_assignment_id, campus_assignment_id)` (see `ApplicationAttachmentServiceImpl.getAttachmentList`).
- Inactive policy config is ignored wherever it would otherwise apply.

## Scheduler service

`https://github.com/pbsgears/sis-scheduler-service`, JDK 17. Uncomment the local `application.yml` values, add a `case` to the switch in `SisSchedularApplication.java` for a new job, rebuild the jar and run `java -jar sis-scheduler-0.0.1-SNAPSHOT.jar <parameter_name>`.
