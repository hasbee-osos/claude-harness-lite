# Engineering Harness (plugin source)

A plugin's root `CLAUDE.md` is not loaded into sessions that use the plugin. The harness ground rules therefore live in the `harness-core` skill (`skills/harness-core/SKILL.md`), which every command reads first and every agent preloads. Team engineering conventions live in `engineering-standards` (`skills/engineering-standards/`). Edit the rules there, not here.

Primary entry point: `/work <jira-ticket-id-or-url>`.
