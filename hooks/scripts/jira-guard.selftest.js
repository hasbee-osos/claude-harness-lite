/**
 * Self-test for jira-guard. Feeds hook payloads to the guard; makes no network call.
 *
 *   node hooks/scripts/jira-guard.selftest.js
 */
"use strict";
const path = require("path");
const { execFileSync } = require("child_process");

const GUARD = process.argv[2] || path.join(__dirname, "jira-guard.js");
let failures = 0;

// Returns "ALLOW" or "DENY".
function guard(toolName, toolInput) {
  const payload = JSON.stringify({ tool_name: toolName, tool_input: toolInput || {} });
  const stdout = execFileSync("node", [GUARD], { input: payload, encoding: "utf8" });
  return /permissionDecision"\s*:\s*"deny"/.test(stdout) ? "DENY" : "ALLOW";
}

function check(name, toolName, toolInput, expected) {
  const got = guard(toolName, toolInput);
  if (got === expected) {
    console.log(`  PASS [${expected}] ${name}`);
  } else {
    failures++;
    console.log(`  FAIL expected ${expected}, got ${got}: ${name}`);
  }
}

console.log("\nRead tools");
check("getJiraIssue", "mcp__atlassian__getJiraIssue", {}, "ALLOW");
check("searchJiraIssuesUsingJql", "mcp__atlassian__searchJiraIssuesUsingJql", {}, "ALLOW");
check("discover", "mcp__atlassian__discover", { query: "download attachment" }, "ALLOW");
check("claude.ai connector name", "mcp__claude_ai_Atlassian__getJiraIssue", {}, "ALLOW");

console.log("\nexecuteRead is gated by operation name");
check("downloadJiraIssueAttachment", "mcp__atlassian__executeRead", { name: "downloadJiraIssueAttachment", inputs: { attachmentId: "1" } }, "ALLOW");
check("listJiraIssueComments", "mcp__atlassian__executeRead", { name: "listJiraIssueComments", inputs: { issueIdOrKey: "GSIS-1" } }, "ALLOW");
check("unlisted read operation", "mcp__atlassian__executeRead", { name: "listJiraIssueWorklogs" }, "DENY");
check("confluence download", "mcp__atlassian__executeRead", { name: "downloadConfluenceAttachment" }, "DENY");
check("no operation name", "mcp__atlassian__executeRead", {}, "DENY");
check("case must match", "mcp__atlassian__executeRead", { name: "DownloadJiraIssueAttachment" }, "DENY");

console.log("\nWrites stay blocked");
check("executeWrite", "mcp__atlassian__executeWrite", { name: "addCommentToJiraIssue" }, "DENY");
check("executeWrite with an allowlisted name", "mcp__atlassian__executeWrite", { name: "downloadJiraIssueAttachment" }, "DENY");
check("executeDestructive", "mcp__atlassian__executeDestructive", { name: "deleteJiraIssue" }, "DENY");
check("editJiraIssue", "mcp__atlassian__editJiraIssue", {}, "DENY");
check("unknown tool", "mcp__jira__somethingNew", {}, "DENY");

console.log("\nOther MCP servers are untouched");
check("non-Atlassian server", "mcp__github__create_pull_request", {}, "ALLOW");
check("non-MCP tool", "Bash", { command: "ls" }, "ALLOW");

console.log("\n" + (failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"));
process.exit(failures === 0 ? 0 : 1);
