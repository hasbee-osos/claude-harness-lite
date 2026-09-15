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

### Jira Cloud (current setup: `gearsjira.atlassian.net`)

Use Atlassian's official Rovo MCP Server (OAuth 2.1 — no token stored locally; it acts with **your** Jira identity and permissions).

1. Register it once for your user, from any terminal:
   ```bash
   claude mcp add --transport http --scope user atlassian https://mcp.atlassian.com/v2/mcp
   ```
   (`--scope local` instead limits it to the current project; avoid `--scope project` unless the team agrees to share the entry via `.mcp.json`.)
2. Start Claude Code in the product repo, run `/mcp`, select `atlassian`, and complete the browser login, choosing the `gearsjira` site.
3. If the connection is refused, your Atlassian organization admin may need to allow the Rovo MCP Server for the site.

The server exposes write tools (create/edit/comment/transition) by default. This plugin needs **read-only** access, so write tools must be blocked on the Claude Code side — see the read-only guard below.

### Other Jira MCP servers

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

## Read-only guard

`hooks/scripts/jira-guard.js` (PreToolUse, matcher `mcp__.*`) enforces read-only Jira on the Claude Code side. On any MCP server whose name contains `atlassian` or `jira` (including the claude.ai Atlassian connector), it allows only the tools in its `READ_TOOLS` allowlist. Everything else is denied: create, edit, comment, transition, worklog, Confluence, and any tool it doesn't recognize. Allowed tools still go through the normal permission prompt.

Limits:
- It protects only Claude sessions with this plugin loaded. The OAuth login carries your full Jira permissions, so any other client using it can still write. For read-only access enforced on the Jira side, use a Jira account that has only Browse permissions.
- The allowlist was written before the server was connected. After connecting, check which tools the harness actually needs. If a read tool is blocked, add its name to `READ_TOOLS`. Never add write tools.

## If no Jira MCP is configured

The harness degrades gracefully: `/work` and `/analyze` ask the user to paste the ticket content, record that context was manually provided, and continue. Nothing is fabricated.

## Extension points (not implemented yet — do not fake them)

- Jira **write** capability: posting the final run summary and artifacts as comments, updating status/labels
- Attachments, if the installed MCP supports them
- Git provider MCP for PR creation (the harness currently uses `gh` if authenticated, otherwise a prefilled compare link for the human)
- CI/CD and other enterprise systems

If the installed MCP does not support an operation (e.g. attachments), the harness documents the limitation and continues with local runtime artifacts in `.runtime/<ticket-id>/`.
