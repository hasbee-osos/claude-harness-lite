# Jira MCP Integration Point (read-only)

This directory documents the external-systems integration point. **No Jira MCP server is bundled and no credentials exist in this plugin.** Do not invent one.

## Current capability

The harness expects a **read-only** Jira MCP server configured by the user or the target project. With it, the workflow can:

- get a Jira issue
- read description
- read comments
- read relevant metadata
- read linked issues (where supported)

## How to configure

Add a Jira MCP server of your choice to the **target project** (not this plugin), e.g. in `<target-project>/.mcp.json`:

```json
{
  "mcpServers": {
    "jira": {
      "command": "<your-jira-mcp-server-command>",
      "args": ["..."],
      "env": {
        "JIRA_URL": "https://jira.example.com",
        "JIRA_TOKEN": "<set via your secret mechanism>"
      }
    }
  }
}
```

Or register it with `claude mcp add`. Use your organization's approved Jira MCP server and secret management — the harness never hardcodes credentials.

## If no Jira MCP is configured

The harness degrades gracefully: `/work` and `/analyze` ask the user to paste the ticket content, record that context was manually provided, and continue. Nothing is fabricated.

## Extension points (not implemented yet — do not fake them)

- Jira **write** capability: posting the final run summary and artifacts as comments, updating status/labels
- Attachments, if the installed MCP supports them
- Git provider MCP for PR creation (the harness currently falls back to `gh` or generates PR text)
- CI/CD and other enterprise systems

If the installed MCP does not support an operation (e.g. attachments), the harness documents the limitation and continues with local runtime artifacts in `.runtime/<ticket-id>/`.
