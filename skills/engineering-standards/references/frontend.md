# Frontend conventions (Angular)

**This file is part of the team's guidelines** — conventions for the Angular UI. Edit it directly: one rule per bullet, stated in words even when a screenshot shows it. See `docs/maintaining-guidelines.md`. Rules for every stack (dates, code hygiene) are in the `engineering-standards` skill itself.

These are **project conventions**. A change that ignores them is wrong even if it compiles and its tests pass.

## Components and pages

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

## Business config

- Frontend reads policy values through `PolicyParameterService.getPolicyValueByCode`.
