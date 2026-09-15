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
 * Allowed tools still go through the normal permission prompt.
 */
const READ_TOOLS = new Set([
  "atlassianUserInfo",
  "getAccessibleAtlassianResources",
  "getJiraIssue",
  "searchJiraIssuesUsingJql",
  "getJiraIssueRemoteIssueLinks",
  "getVisibleJiraProjects",
  "getJiraProjectIssueTypesMetadata"
]);

const ATLASSIAN_SERVER = /atlassian|jira/i;

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let toolName = "";
  try {
    toolName = String(JSON.parse(raw).tool_name || "");
  } catch {
    process.exit(0);
  }

  const m = toolName.match(/^mcp__(.+?)__(.+)$/);
  if (!m || !ATLASSIAN_SERVER.test(m[1])) process.exit(0);
  if (READ_TOOLS.has(m[2])) process.exit(0);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "Blocked by engineering-harness jira-guard: `" + toolName + "` is not on the Jira read-only allowlist. " +
          "The harness has read-only Jira access; do not retry. If this is a read tool, a human can add it to READ_TOOLS in hooks/scripts/jira-guard.js."
      }
    })
  );
  process.exit(0);
});
