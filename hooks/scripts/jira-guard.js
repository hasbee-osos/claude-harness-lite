#!/usr/bin/env node
/**
 * Jira read-only guard (PreToolUse hook, matcher: mcp__.*).
 *
 * The Atlassian MCP server acts with the human's full Jira permissions and exposes
 * write tools (create/edit/comment/transition) with no read-only mode. This guard
 * allows only the read tools listed below on any Atlassian/Jira MCP server
 * (e.g. mcp__atlassian__*, mcp__claude_ai_Atlassian__*) and denies everything else,
 * including tools it does not recognize.
 *
 * `executeRead` runs any operation the server labels read-tier, so it is not trusted as
 * a whole: only the operation names in READ_OPERATIONS may pass through it.
 * `executeWrite` and `executeDestructive` are never allowed.
 *
 * Allowed tools still go through the normal permission prompt.
 */
const READ_TOOLS = new Set([
  "atlassianUserInfo",
  "getAccessibleAtlassianResources",
  "getJiraIssue",
  "searchJiraIssuesUsingJql",
  "getJiraIssueRemoteIssueLinks",
  "getVisibleJiraProjects",
  "getJiraProjectIssueTypesMetadata",
  "discover" // returns operation names and inputs only; runs nothing
]);

// Operations the harness may run through executeRead. Add a name only after checking
// that `discover` reports it with executeTool "executeRead".
const READ_OPERATIONS = new Set([
  "listJiraIssueComments",      // /work step 2 reads the ticket's comments
  "downloadJiraIssueAttachment" // short-lived download URL; see skills/jira-attachments
]);

const ATLASSIAN_SERVER = /atlassian|jira/i;

function deny(toolName, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "Blocked by engineering-harness jira-guard: " + reason
      }
    })
  );
  process.exit(0);
}

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const toolName = String(payload.tool_name || "");

  const m = toolName.match(/^mcp__(.+?)__(.+)$/);
  if (!m || !ATLASSIAN_SERVER.test(m[1])) process.exit(0);
  if (READ_TOOLS.has(m[2])) process.exit(0);

  if (m[2] === "executeRead") {
    const op = String((payload.tool_input && payload.tool_input.name) || "");
    if (READ_OPERATIONS.has(op)) process.exit(0);
    deny(
      toolName,
      "operation `" + (op || "<none>") + "` is not on the Jira read-only operation allowlist. " +
        "Do not retry. If it is a read operation the harness needs, a human can add it to READ_OPERATIONS in hooks/scripts/jira-guard.js."
    );
  }

  deny(
    toolName,
    "`" + toolName + "` is not on the Jira read-only allowlist. " +
      "The harness has read-only Jira access; do not retry. If this is a read tool, a human can add it to READ_TOOLS in hooks/scripts/jira-guard.js."
  );
});
