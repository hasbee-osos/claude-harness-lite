# Java Code Review Guidelines

**This file is the guidelines.** Edit it directly. It began as the six PDFs now in `archive/java-code review guideline/` (superseded 2026-09-16); those PDFs are text only, so no diagrams or figures were lost.

This is general Java guidance; **project-specific rules in [`engineering-standards/references/sis-development-guidelines.md`](../../engineering-standards/references/sis-development-guidelines.md) win where the two differ.** See `docs/maintaining-guidelines.md`.

## Code structure and readability

- Package by responsibility: `model/` (POJOs), `service/` (business logic), `controller/` (input/output), `repository/` (data access), `util/`.
- Order inside a class: imports, class declaration, constants, fields, constructors, getters/setters, business methods, then `toString`/`equals`/`hashCode`.
- Naming: classes `PascalCase`, methods and variables `camelCase`, constants `UPPER_SNAKE_CASE`.
- Formatting: 4-space indentation, blank lines between logical sections, lines under 100 characters.
- Javadoc on public classes and methods (`@param`, `@return`); inline comments only where necessary.
- Avoid: long methods (split them), deep nesting (use guard clauses), magic numbers (use constants).

## Functionality and business logic

- Keep business logic in service classes, never in controllers or models.
- Method names reflect business operations.
- Validate arguments and fail with a clear exception (e.g. `IllegalArgumentException` for a non-positive quantity).
- Write unit tests for business logic.
- No hardcoded values — use constants or configuration.
- Document business rules in comments or external documentation.

## Maintainability and modularity

- Follow SOLID principles.
- Meaningful class and method names; short, focused methods that each do one well-defined task.
- Separate concerns using layers.
- Write unit tests for each module.

## Error handling and logging

- Use try-catch-finally deliberately; catch the specific exception.
- Create custom exceptions (extending `Exception`) for application-specific error cases.
- Logging frameworks in use: `java.util.logging`, Log4j, SLF4J with Logback (a facade that decouples the implementation).

## Security

- Least privilege, defense in depth, fail-safe defaults. Nothing hardcoded.
- Validate every user input to prevent injection; reject what does not match the expected pattern.
- Strong authentication and role-based access control.
- HTTPS for data in transit; no outdated protocols such as SSL.
- Never expose sensitive information in error messages; log exceptions securely.
- Keep sensitive data out of logs and restrict access to them.

## Performance

- Understand garbage collection before tuning; JVM options such as `-XX:+UseG1GC -Xmx1024m -Xms512m`.
- Use thread pools (`Executors.newFixedThreadPool`) rather than creating threads freely.
- Buffered and asynchronous I/O for file and network work.
- Choose the right data structure (`ArrayList` for fast access, `HashMap` for key-value lookups).
- Profile with VisualVM, JProfiler or Java Mission Control to find real bottlenecks.
