#!/usr/bin/env node
/**
 * Engineering harness desktop notifier.
 *
 * Registered on Stop. A run ending is NOT by itself worth a notification: the
 * developer is usually watching the terminal, and a notification that arrives
 * when they are already there teaches them to ignore the next one. This hook
 * therefore notifies only at the moments the run genuinely needs a person:
 *
 *   input_requested   questions are open - a QA or SME packet is ready to post,
 *                     or a developer-only question is waiting
 *   evaluation        the Evaluator returned a verdict to read
 *   escalated         the run stopped on something only a human can decide
 *   handed_off        every agent has concluded; the PRs are ready for review
 *
 * Everything else is silent: routine stage boundaries, each subagent finishing,
 * and the many turns where the run simply continues.
 *
 * The qualifying moment is read from the ticket's journal, so a new stage that
 * appends one of these events is covered without changing this file. Each event
 * notifies once: the last one announced per ticket is recorded in the brain's
 * machine-local metrics folder.
 *
 * Like every hook here, it must never block or fail a session: every path is
 * guarded, nothing is written to stdout, and the process always exits 0.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

// Events that mean a person is needed, and how each one reads on a notification.
const TRIGGERS = {
  input_requested: (e) => {
    const n = typeof e.questions === "number" ? e.questions : null;
    const count = n ? `${n} question${n === 1 ? "" : "s"}` : "Questions";
    if (e.audience === "qa") return `${count} for QA - qa-packet.md ready to post`;
    if (e.audience === "sme") return `${count} for the SME - sme-packet.md ready to post`;
    return `${count} need your answer`;
  },
  evaluation: (e) => {
    const blocking = typeof e.blocking === "number" ? e.blocking : 0;
    return `Evaluator: ${e.verdict || "verdict returned"} - ${blocking} blocking`;
  },
  escalated: (e) => `Escalated${e.reason ? `: ${e.reason}` : " - needs your decision"}`,
  handed_off: (e) => {
    const refs = Array.isArray(e.refs) ? e.refs.length : 0;
    const to = e.to === "reviewers" ? "review" : e.to || "hand-off";
    return refs ? `Work complete - ${refs} PR${refs === 1 ? "" : "s"} ready for ${to}` : `Work complete - ready for ${to}`;
  },
};

const BRAIN_MARKER = ".harness-brain";
const JOURNAL_TAIL_BYTES = 64 * 1024;

function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

/** Find the brain by its marker file, exactly as git-guard and telemetry do. */
function findBrain(startDir) {
  let dir = startDir;
  for (let i = 0; i < 5 && dir; i++) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const candidate = path.join(dir, entry.name);
        if (fs.existsSync(path.join(candidate, BRAIN_MARKER))) return candidate;
      }
    } catch {
      /* unreadable directory - keep walking up */
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * The ticket this session last worked on. current.json is cleared to {} when a
 * run stops, so fall back to the newest line of index.jsonl.
 */
function activeTicket(brainDir) {
  const current = readJsonFile(path.join(brainDir, "current.json"), {});
  if (current && current.ticket) return String(current.ticket);
  try {
    const file = path.join(brainDir, "index.jsonl");
    const lines = fs.readFileSync(file, "utf8").trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const row = parseJson(lines[i], null);
      if (row && row.ticket) return String(row.ticket);
    }
  } catch {
    /* no index yet */
  }
  return null;
}

/** The last journal event that qualifies as a human-attention moment. */
function lastTrigger(brainDir, ticket) {
  const file = path.join(brainDir, "tickets", ticket, "journal.jsonl");
  let text = "";
  try {
    const { size } = fs.statSync(file);
    const start = Math.max(0, size - JOURNAL_TAIL_BYTES);
    const fd = fs.openSync(file, "r");
    try {
      const buf = Buffer.alloc(size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      text = buf.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
  const lines = text.split("\n");
  // A partial first line when the tail starts mid-file is dropped by parseJson.
  for (let i = lines.length - 1; i >= 0; i--) {
    const event = parseJson(lines[i], null);
    if (event && event.event && TRIGGERS[event.event]) return event;
  }
  return null;
}

function send(title, body) {
  const opts = { detached: true, stdio: "ignore", windowsHide: true };
  let child;
  if (process.platform === "win32") {
    const script = path.join(__dirname, "notify-toast.ps1");
    child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-Title", title, "-Body", body],
      opts
    );
  } else if (process.platform === "darwin") {
    const esc = (s) => String(s).replace(/["\\]/g, "\\$&");
    child = spawn("osascript", ["-e", `display notification "${esc(body)}" with title "${esc(title)}"`], opts);
  } else {
    child = spawn("notify-send", [title, body], opts);
  }
  child.on("error", () => {
    /* no notifier on this machine - the run is unaffected */
  });
  child.unref();
}

function main() {
  let input = "";
  try {
    input = fs.readFileSync(0, "utf8");
  } catch {
    /* no stdin */
  }
  const payload = parseJson(input, {}) || {};
  const brainDir = findBrain(payload.cwd || process.cwd());
  if (!brainDir) return;

  const ticket = activeTicket(brainDir);
  if (!ticket) return;

  const event = lastTrigger(brainDir, ticket);
  if (!event) return;

  // Announce each moment once.
  const cursorFile = path.join(brainDir, "metrics", "notify-cursor.json");
  const cursor = readJsonFile(cursorFile, {}) || {};
  const stamp = `${event.ts || ""}|${event.event}`;
  if (cursor[ticket] === stamp) return;

  const state = readJsonFile(path.join(brainDir, "tickets", ticket, "state.json"), {}) || {};
  const summary = TRIGGERS[event.event](event);
  const title = state.jira && state.jira.title ? `${ticket}: ${String(state.jira.title).slice(0, 60)}` : ticket;

  try {
    fs.mkdirSync(path.dirname(cursorFile), { recursive: true });
    cursor[ticket] = stamp;
    fs.writeFileSync(cursorFile, JSON.stringify(cursor, null, 2) + "\n");
  } catch {
    /* an unwritable cursor may repeat a notification; it must not stop one */
  }

  send(title, summary);
}

try {
  main();
} catch {
  // Absolutely never fail the session.
}
process.exit(0);
