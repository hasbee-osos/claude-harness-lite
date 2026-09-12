---
name: angular
description: Angular frontend knowledge - components, services, routing, forms, HTTP clients, RxJS, templates, validation, testing, and UI regression risk. Use when working with Angular code.
---

# Angular

Use this skill when the change touches the Angular frontend.

## Understand before changing

- Components, services, and module organization used in this project
- Routing and route guards
- Forms: reactive vs template-driven, where frontend validation lives
- HTTP client usage, interceptors, API integration and error handling
- State management approach where present
- RxJS patterns: subscription lifecycles, takeUntil/async pipe, error channels
- Testing setup in this repo (e.g. Karma/Jest/Playwright) and existing conventions

## Rules

- Follow existing project conventions; do not introduce new frontend architecture unnecessarily.
- If the backend contract changes, verify the affected UI flows: loading, success, error, and empty states.
- UI regression risk: check forms, validation messages, and error display paths related to the change.
- Prefer targeted component/service tests plus targeted manual verification of affected screens.
