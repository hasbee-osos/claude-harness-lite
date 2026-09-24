#!/usr/bin/env node
/**
 * Merge-conflict checks for the harness (`git-workflow` → Merge conflicts). Read-only: it never
 * changes a working tree, an index or a ref, and makes no network call.
 *
 *   node conflicts.js check   <repo> <target> <head>
 *       Dry-run merge of <head> into <target> (git merge-tree). Conflicted files with each
 *       conflicting hunk, both sides and the enclosing block.
 *
 *   node conflicts.js name    <repo> <ticket-branch> <target>
 *       The resolve-branch name for this target, and the resolve branches that already exist
 *       for it locally or on origin.
 *
 *   node conflicts.js compare <repo> <target> <ticket-branch> <resolve-branch> [--record <file>]
 *       Equivalence: does the resolve branch contribute exactly the ticket's change, apart from
 *       recorded conflict resolutions? The record is JSON:
 *         { "resolved":  [{ "file": "...", "class": "mechanical|semantic", "rationale": "..." }],
 *           "justified": [{ "file": "...", "line": "...", "reason": "..." }] }
 *
 * Refs are passed as given (e.g. origin/base-sandbox-qa). Output is JSON on stdout; `compare`
 * adds a Markdown table for the report and the PR. Exit 0 with a result, 1 on usage or git error.
 * Needs git >= 2.38 (merge-tree --write-tree).
 */
"use strict";
const fs = require("fs");
const { spawnSync } = require("child_process");

const MAX_SIDE_LINES = 40; // per side of a hunk; the rest is summarised, keeping output small

function fail(msg) {
  console.error("conflicts: " + msg);
  process.exit(1);
}

function git(repo, args, { allow = [0] } = {}) {
  const r = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (r.error) fail("cannot run git: " + r.error.message);
  if (!allow.includes(r.status)) fail("git " + args.join(" ") + " failed: " + (r.stderr || "").trim());
  return { out: r.stdout, status: r.status };
}

const sha = (repo, ref) => git(repo, ["rev-parse", "--verify", ref + "^{commit}"]).out.trim();
const mergeBase = (repo, a, b) => git(repo, ["merge-base", a, b]).out.trim();
const isAncestor = (repo, a, b) => git(repo, ["merge-base", "--is-ancestor", a, b], { allow: [0, 1] }).status === 0;

// Many `<rev>:<path>` blobs in one git process (one spawn per file is slow on Windows).
// Missing paths map to null.
function showMany(repo, pairs) {
  const specs = pairs.map(([rev, file]) => rev + ":" + file);
  const result = new Map();
  if (!specs.length) return result;
  const r = spawnSync("git", ["-C", repo, "cat-file", "--batch"], { input: specs.join("\n") + "\n", maxBuffer: 1024 * 1024 * 1024 });
  if (r.status !== 0) fail("git cat-file failed: " + String(r.stderr).trim());
  const buf = r.stdout;
  let pos = 0;
  for (const spec of specs) {
    const eol = buf.indexOf(10, pos);
    const header = buf.toString("utf8", pos, eol);
    pos = eol + 1;
    const m = header.match(/^\S+ (\S+) (\d+)$/);
    if (!m) {
      result.set(spec, null); // "<spec> missing" or ambiguous
      continue;
    }
    const size = Number(m[2]);
    result.set(spec, m[1] === "blob" ? buf.toString("utf8", pos, pos + size) : null);
    pos += size + 1;
  }
  return result;
}

// --- check -------------------------------------------------------------------------------------

// A line that opens a block worth naming: a Java/TS method or class, an Angular decorator, a
// Liquibase changeSet, an SQL statement, a JSON key at the top two levels.
const DECLARATION =
  /^\s*((public|protected|private|static|final|abstract|export|async|function|class|interface|enum|@\w+)\b.*|[\w<>\[\], ?]+\s+\w+\s*\([^;]*\)\s*(\{|throws\b.*)?\s*$|<changeSet\b.*|(CREATE|ALTER|INSERT|UPDATE|DELETE)\b.*|\s{0,4}"[^"]+"\s*:\s*[{\[]?\s*)$/i;

function enclosing(lines, index) {
  for (let i = index - 1; i >= 0; i--) {
    if (DECLARATION.test(lines[i]) && !/^\s*(if|for|while|switch|catch|return|else)\b/.test(lines[i])) {
      return { line: i + 1, text: lines[i].trim().slice(0, 160) };
    }
  }
  return null;
}

function clip(side) {
  if (side.length <= MAX_SIDE_LINES) return { lines: side };
  return { lines: side.slice(0, MAX_SIDE_LINES), omitted: side.length - MAX_SIDE_LINES };
}

// Hunks from a file written by merge-tree with conflict markers (merge, diff3 and zdiff3 styles).
function hunks(content) {
  const lines = content.split(/\r?\n/);
  const out = [];
  let cur = null;
  let part = null;
  lines.forEach((l, i) => {
    if (l.startsWith("<<<<<<< ")) {
      cur = { line: i + 1, target: [], base: [], ticket: [] };
      part = "target";
    } else if (cur && l.startsWith("||||||| ")) part = "base";
    else if (cur && l === "=======") part = "ticket";
    else if (cur && l.startsWith(">>>>>>> ")) {
      out.push({
        line: cur.line,
        enclosing: enclosing(lines, cur.line - 1),
        target: clip(cur.target),
        ...(cur.base.length ? { base: clip(cur.base) } : {}),
        ticket: clip(cur.ticket)
      });
      cur = null;
    } else if (cur) cur[part].push(l);
  });
  return out;
}

// Dry-run merge; exported so compare can find the conflicted files the same way.
function dryMerge(repo, target, head) {
  const r = git(repo, ["merge-tree", "--write-tree", "--name-only", "--messages", target, head], { allow: [0, 1] });
  const [first, ...rest] = r.out.split(/\r?\n/);
  const blank = rest.indexOf("");
  const names = (blank < 0 ? rest : rest.slice(0, blank)).filter(Boolean);
  const messages = blank < 0 ? [] : rest.slice(blank + 1).filter(Boolean);
  const kinds = {};
  for (const m of messages) {
    const k = m.match(/^CONFLICT \(([^)]+)\):/);
    if (!k) continue;
    for (const n of names) if (m.includes(n)) kinds[n] = kinds[n] || k[1];
  }
  return { clean: r.status === 0, tree: first.trim(), files: names, kinds, messages };
}

function check(repo, target, head) {
  const m = dryMerge(repo, target, head);
  const blobs = showMany(repo, m.files.map((f) => [m.tree, f]));
  const files = m.files.map((file) => {
    const content = blobs.get(m.tree + ":" + file);
    const kind = m.kinds[file] || "content";
    if (content === null) return { file, kind, hunks: [], note: "not present in the merged tree (deleted or renamed on one side)" };
    if (content.includes("\0")) return { file, kind, hunks: [], note: "binary file" };
    return { file, kind, hunks: hunks(content) };
  });
  return {
    repo,
    target,
    head,
    target_sha: sha(repo, target),
    head_sha: sha(repo, head),
    clean: m.clean,
    files,
    messages: m.messages.filter((l) => l.startsWith("CONFLICT"))
  };
}

// --- name --------------------------------------------------------------------------------------

function name(repo, ticket, target) {
  const bare = target.replace(/^(refs\/)?(remotes\/)?origin\//, "");
  const base = ticket.replace(/^(refs\/)?(remotes\/)?origin\//, "") + "-" + bare + "-conflict-resolved";
  const refs = git(repo, ["for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes/origin"]).out.split(/\r?\n/);
  const re = new RegExp("^(origin/)?" + base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(-(\\d+))?$");
  const existing = [...new Set(refs.map((r) => r.match(re)).filter(Boolean).map((m) => m[0].replace(/^origin\//, "")))];
  const highest = existing.reduce((n, b) => Math.max(n, Number((b.match(/-(\d+)$/) || [])[1] || 1)), 0);
  return { base, existing, next: highest === 0 ? base : base + "-" + (highest + 1) };
}

// --- compare -----------------------------------------------------------------------------------

// Lines too common to prove anything (braces, blank lines, lone keywords) are ignored.
const trivial = (l) => l.length < 3 || /^[\s{}()[\];,.<>/*=+-]*$/.test(l) || /^(else|try|finally|return;?|break;|\}\s*else\s*\{)$/.test(l);
const norm = (l) => l.replace(/\r$/, "").trim();

// Per file: multisets of non-trivial added and removed lines (trimmed).
function diffLines(repo, from, to) {
  const out = git(repo, ["diff", "--no-renames", "--no-color", "--unified=0", from, to]).out;
  const files = {};
  let f = null;
  for (const raw of out.split("\n")) {
    const h = raw.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (h) {
      f = files[h[2]] = files[h[2]] || { added: new Map(), removed: new Map() };
      continue;
    }
    if (!f || raw.startsWith("+++") || raw.startsWith("---")) continue;
    const sign = raw[0];
    if (sign !== "+" && sign !== "-") continue;
    const l = norm(raw.slice(1));
    if (trivial(l)) continue;
    const m = sign === "+" ? f.added : f.removed;
    m.set(l, (m.get(l) || 0) + 1);
  }
  return files;
}

// Occurrences of a normalised line in a file's content; each content is indexed once.
const lineCounts = new Map();
function countIn(content, line) {
  if (content === null) return 0;
  let counts = lineCounts.get(content);
  if (!counts) {
    counts = new Map();
    for (const l of content.split("\n")) {
      const n = norm(l);
      counts.set(n, (counts.get(n) || 0) + 1);
    }
    lineCounts.set(content, counts);
  }
  return counts.get(line) || 0;
}

const MARKER = /^(<{7}|>{7}) /m;

function compare(repo, target, ticket, resolve, recordFile) {
  let record = { resolved: [], justified: [] };
  if (recordFile) {
    try {
      record = Object.assign(record, JSON.parse(fs.readFileSync(recordFile, "utf8")));
    } catch (e) {
      fail("cannot read record " + recordFile + ": " + e.message);
    }
  }
  const resolvedFiles = new Set(record.resolved.map((r) => r.file));
  const justified = (file, line) => record.justified.find((j) => j.file === file && norm(j.line) === line);

  // The target commit actually merged into the resolve branch, so a target that moved on since
  // does not show up as reverted lines.
  const mergedTarget = mergeBase(repo, target, resolve);
  const base = mergeBase(repo, mergedTarget, ticket);
  const expected = diffLines(repo, base, ticket);
  const actual = diffLines(repo, mergedTarget, resolve);
  const conflicted = new Set(dryMerge(repo, mergedTarget, ticket).files);

  const checks = {
    contains_ticket_head: isAncestor(repo, ticket, resolve),
    same_files: true,
    nothing_lost: true,
    nothing_foreign: true,
    no_markers: true,
    unchanged_outside_conflicts: true
  };
  const rows = [];
  const allFiles = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
  const blobs = showMany(repo, allFiles.flatMap((f) => [[resolve, f], [base, f], [mergedTarget, f]]));

  for (const file of allFiles) {
    const e = expected[file];
    const a = actual[file];
    const row = { file, conflicted: conflicted.has(file), status: "ok", lost: [], foreign: [], justified: [] };
    const resolvedContent = blobs.get(resolve + ":" + file);
    const baseContent = blobs.get(base + ":" + file);

    if (resolvedContent !== null && MARKER.test(resolvedContent)) {
      checks.no_markers = false;
      row.status = "conflict markers";
    }
    if (e && !a) {
      // The ticket's lines may already be on the target (e.g. the same fix merged earlier).
      const missing = [...e.added.keys()].filter((l) => countIn(resolvedContent, l) === 0);
      if (missing.length) {
        checks.same_files = false;
        row.status = "missing from resolve branch";
        row.lost = missing;
      } else row.status = "already on target";
      rows.push(row);
      continue;
    }
    if (a && !e) {
      const lines = [...a.added.keys(), ...[...a.removed.keys()].map((l) => "(removed) " + l)];
      if (resolvedFiles.has(file)) {
        row.resolution = lines; // a recorded post-merge fix, e.g. a call site the target renamed
        row.status = "outside the ticket (recorded)";
      } else {
        checks.same_files = false;
        row.foreign = lines;
        row.status = "not part of the ticket";
      }
      rows.push(row);
      continue;
    }

    // Nothing lost: the ticket's net change to each line's count (a moved line nets to zero) is
    // present, measured from the ticket's base or from the merged target - the latter covers a
    // target that made the same change itself.
    const targetContent = blobs.get(mergedTarget + ":" + file);
    for (const l of new Set([...e.added.keys(), ...e.removed.keys()])) {
      const net = (e.added.get(l) || 0) - (e.removed.get(l) || 0);
      if (net === 0) continue;
      const r = countIn(resolvedContent, l);
      const held = (from) => (net > 0 ? r - countIn(from, l) >= net : countIn(from, l) - r >= -net);
      if (held(baseContent) || held(targetContent)) continue;
      const shown = net > 0 ? l : "(removed) " + l;
      const j = justified(file, l);
      if (j) row.justified.push({ line: shown, reason: j.reason });
      else row.lost.push(shown);
    }
    if (row.lost.length) {
      checks.nothing_lost = false;
      row.status = "lines lost";
    }

    // Nothing foreign: every line the resolve branch adds beyond the ticket's own is part of a
    // recorded resolution of a conflicted file.
    const netOf = (d, l) => (d.added.get(l) || 0) - (d.removed.get(l) || 0);
    const foreign = [...new Set([...a.added.keys(), ...a.removed.keys()])]
      .filter((l) => netOf(a, l) !== netOf(e, l) && netOf(a, l) !== 0)
      .map((l) => (netOf(a, l) > 0 ? l : "(removed) " + l));
    if (foreign.length) {
      if (!resolvedFiles.has(file)) {
        if (conflicted.has(file)) {
          checks.nothing_foreign = false;
          row.status = "unrecorded resolution";
        } else {
          checks.unchanged_outside_conflicts = false;
          row.status = "changed outside any conflict";
        }
        row.foreign = foreign;
      } else {
        row.resolution = foreign; // recorded; shown to the reviewer, not a failure
        if (row.status === "ok") row.status = "resolved (recorded)";
      }
    } else if (row.status === "ok" && conflicted.has(file)) row.status = "resolved";
    rows.push(row);
  }

  const pass = Object.values(checks).every(Boolean);
  return {
    repo,
    target,
    ticket,
    resolve,
    merged_target_sha: mergedTarget,
    ticket_sha: sha(repo, ticket),
    resolve_sha: sha(repo, resolve),
    pass,
    checks,
    files: rows,
    markdown: markdown(pass, checks, rows)
  };
}

function markdown(pass, checks, rows) {
  const label = {
    contains_ticket_head: "Resolve branch contains the ticket branch's head",
    same_files: "Same files as the ticket",
    nothing_lost: "Nothing lost",
    nothing_foreign: "Nothing foreign",
    no_markers: "No conflict markers",
    unchanged_outside_conflicts: "Unchanged outside conflicts"
  };
  const out = [`**Equivalence: ${pass ? "PASS" : "FAIL"}**`, "", "| Check | Result |", "|---|---|"];
  for (const [k, v] of Object.entries(checks)) out.push(`| ${label[k]} | ${v ? "pass" : "**FAIL**"} |`);
  out.push("", "| File | Conflicted | Status | Lines lost | Lines beyond the ticket |", "|---|---|---|---|---|");
  for (const r of rows) {
    const beyond = (r.foreign.length || (r.resolution || []).length) + (r.resolution ? " (recorded)" : "");
    out.push(`| \`${r.file}\` | ${r.conflicted ? "yes" : "no"} | ${r.status} | ${r.lost.length} | ${beyond || 0} |`);
  }
  const detail = rows.filter((r) => r.lost.length || r.foreign.length || r.justified.length);
  for (const r of detail) {
    out.push("", `\`${r.file}\``);
    for (const l of r.lost) out.push(`- lost: \`${l.slice(0, 140)}\``);
    for (const l of r.foreign) out.push(`- beyond the ticket: \`${l.slice(0, 140)}\``);
    for (const j of r.justified) out.push(`- justified: \`${j.line.slice(0, 140)}\` — ${j.reason}`);
  }
  return out.join("\n");
}

// --- main --------------------------------------------------------------------------------------

if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  const rec = args.indexOf("--record");
  const recordFile = rec >= 0 ? args.splice(rec, 2)[1] : null;
  const need = (n, usage) => {
    if (args.length !== n) fail("usage: conflicts.js " + usage);
  };
  let result;
  if (cmd === "check") {
    need(3, "check <repo> <target> <head>");
    result = check(...args);
  } else if (cmd === "name") {
    need(3, "name <repo> <ticket-branch> <target>");
    result = name(...args);
  } else if (cmd === "compare") {
    need(4, "compare <repo> <target> <ticket-branch> <resolve-branch> [--record <file>]");
    result = compare(...args, recordFile);
  } else fail("unknown command " + (cmd || "(none)") + "; use check, name or compare");
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

module.exports = { check, name, compare, hunks };
