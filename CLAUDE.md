# Engineering Harness (plugin source)

A plugin's root `CLAUDE.md` is not loaded into sessions that use the plugin. The harness ground rules therefore live in the `ground-rules` skill (`skills/ground-rules/SKILL.md`), which every command and agent reads first. Edit the rules there, not here.

Primary entry point: `/work <jira-ticket-id-or-url>`.
