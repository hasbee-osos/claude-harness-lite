/**
 * Self-test for conflicts.js. Builds throwaway repos in a temp folder; touches no real repo and
 * makes no network call.
 *
 *   node skills/git-workflow/scripts/conflicts.selftest.js
 *
 * Each scenario builds a target branch and a ticket branch that both change the same file, then
 * a resolve branch the way git-workflow says (cut from the ticket branch, target merged in).
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { check, name, compare } = require("./conflicts.js");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-conflicts-"));
let failures = 0;

function ok(label, cond, detail) {
  if (cond) console.log(`  PASS ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${detail ? "\n        " + detail : ""}`);
  }
}

function repo(label) {
  const dir = path.join(ROOT, label);
  fs.mkdirSync(dir, { recursive: true });
  const git = (...a) => {
    const r = spawnSync("git", ["-C", dir, ...a], { encoding: "utf8" });
    return r.status;
  };
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  const commit = (msg) => {
    git("add", "-A");
    git("commit", "-qm", msg);
  };
  git("init", "-q", "-b", "base-sandbox-qa");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  git("config", "merge.conflictStyle", "merge");
  return { dir, git, write, commit };
}

const SERVICE = (imports, body) =>
  `package x;\n\n${imports.join("\n")}\n\npublic class FeeService {\n\n    public int total(int a) {\n${body}\n    }\n\n    public String label() {\n        return "fee label";\n    }\n}\n`;

// target and ticket both add an import at the same place, and the ticket also changes total().
function importScenario(label) {
  const r = repo(label);
  r.write("FeeService.java", SERVICE(["import a.Alpha;"], "        return a * 2;"));
  r.commit("seed");
  r.git("switch", "-qc", "base/bugfix/GSIS-1-fee-total");
  r.write("FeeService.java", SERVICE(["import a.Alpha;", "import t.TicketHelper;"], "        return TicketHelper.round(a * 2);"));
  r.commit("GSIS-1: round the fee total");
  r.git("switch", "-q", "base-sandbox-qa");
  r.write("FeeService.java", SERVICE(["import a.Alpha;", "import o.OtherUtil;"], "        return a * 2;"));
  r.commit("GSIS-2: other ticket adds an import");
  return r;
}

function resolveBranch(r, ticket, content) {
  r.git("switch", "-qc", ticket + "-base-sandbox-qa-conflict-resolved", ticket);
  r.git("merge", "--no-ff", "-q", "base-sandbox-qa");
  r.write("FeeService.java", content);
  r.commit("Merge base-sandbox-qa into resolve branch");
  return ticket + "-base-sandbox-qa-conflict-resolved";
}

const TICKET = "base/bugfix/GSIS-1-fee-total";
const BOTH = SERVICE(["import a.Alpha;", "import o.OtherUtil;", "import t.TicketHelper;"], "        return TicketHelper.round(a * 2);");

console.log("\ncheck: clean merge");
{
  const r = repo("clean");
  r.write("A.java", "class A {}\n");
  r.write("B.java", "class B {}\n");
  r.commit("seed");
  r.git("switch", "-qc", TICKET);
  r.write("A.java", "class A { int x; }\n");
  r.commit("GSIS-1");
  r.git("switch", "-q", "base-sandbox-qa");
  r.write("B.java", "class B { int y; }\n");
  r.commit("GSIS-2");
  const c = check(r.dir, "base-sandbox-qa", TICKET);
  ok("reports clean", c.clean === true && c.files.length === 0, JSON.stringify(c.files));
}

console.log("\ncheck: import collision");
{
  const r = importScenario("imports");
  const c = check(r.dir, "base-sandbox-qa", TICKET);
  ok("reports a conflict in FeeService.java", !c.clean && c.files.length === 1 && c.files[0].file === "FeeService.java", JSON.stringify(c.files));
  const h = c.files[0] && c.files[0].hunks[0];
  ok("hunk has both sides", h && h.target.lines.includes("import o.OtherUtil;") && h.ticket.lines.includes("import t.TicketHelper;"), JSON.stringify(h));
  ok("working tree untouched", fs.readFileSync(path.join(r.dir, "FeeService.java"), "utf8").includes("OtherUtil") && !fs.readFileSync(path.join(r.dir, "FeeService.java"), "utf8").includes("<<<<<<<"));
}

console.log("\ncheck: same-method semantic conflict names the method");
{
  const r = repo("semantic");
  r.write("FeeService.java", SERVICE([], "        int v = a * 2;\n        return v;"));
  r.commit("seed");
  r.git("switch", "-qc", TICKET);
  r.write("FeeService.java", SERVICE([], "        int v = a * 3;\n        return v;"));
  r.commit("GSIS-1");
  r.git("switch", "-q", "base-sandbox-qa");
  r.write("FeeService.java", SERVICE([], "        int v = a * 2 + 1;\n        return v;"));
  r.commit("GSIS-2");
  const c = check(r.dir, "base-sandbox-qa", TICKET);
  const h = c.files[0] && c.files[0].hunks[0];
  ok("enclosing block is total()", h && h.enclosing && /int total\(int a\)/.test(h.enclosing.text), JSON.stringify(h && h.enclosing));
}

console.log("\ncheck: Liquibase changesets appended on both sides");
{
  const r = repo("liquibase");
  const log = (sets) => `<databaseChangeLog>\n${sets.join("\n")}\n</databaseChangeLog>\n`;
  const cs = (id) => `    <changeSet id="${id}" author="dev">\n        <sql>select ${id}</sql>\n    </changeSet>`;
  r.write("changelog.xml", log([cs("1")]));
  r.commit("seed");
  r.git("switch", "-qc", TICKET);
  r.write("changelog.xml", log([cs("1"), cs("GSIS-1")]));
  r.commit("GSIS-1");
  r.git("switch", "-q", "base-sandbox-qa");
  r.write("changelog.xml", log([cs("1"), cs("GSIS-2")]));
  r.commit("GSIS-2");
  const c = check(r.dir, "base-sandbox-qa", TICKET);
  ok("reports the changelog conflict", !c.clean && c.files[0].file === "changelog.xml");
  r.git("switch", "-qc", TICKET + "-base-sandbox-qa-conflict-resolved", TICKET);
  r.git("merge", "-q", "base-sandbox-qa");
  r.write("changelog.xml", log([cs("1"), cs("GSIS-2"), cs("GSIS-1")]));
  r.commit("resolve");
  const e = compare(r.dir, "base-sandbox-qa", TICKET, TICKET + "-base-sandbox-qa-conflict-resolved");
  ok("keeping both changesets passes", e.pass, e.markdown);
}

console.log("\ncompare: correct mechanical resolution");
{
  const r = importScenario("correct");
  const rb = resolveBranch(r, TICKET, BOTH);
  const e = compare(r.dir, "base-sandbox-qa", TICKET, rb);
  ok("passes with no record needed", e.pass, e.markdown);
  ok("markdown says PASS", e.markdown.startsWith("**Equivalence: PASS**"));
}

console.log("\ncompare: a line the ticket moves is neither lost nor foreign");
{
  // The seed logs in total(); the ticket moves that call into label(); the target adds an import.
  const LOG = "        audit.log();";
  const withLog = (imports, inTotal) =>
    SERVICE(imports, (inTotal ? LOG + "\n" : "") + "        return a * 2;").replace('        return "fee label";', (inTotal ? "" : LOG + "\n") + '        return "fee label";');
  const r = repo("moved");
  r.write("FeeService.java", withLog(["import a.Alpha;"], true));
  r.commit("seed");
  r.git("switch", "-qc", TICKET);
  r.write("FeeService.java", withLog(["import a.Alpha;", "import t.TicketHelper;"], false));
  r.commit("GSIS-1: log from label()");
  r.git("switch", "-q", "base-sandbox-qa");
  r.write("FeeService.java", withLog(["import a.Alpha;", "import o.OtherUtil;"], true));
  r.commit("GSIS-2");
  const rb = resolveBranch(r, TICKET, withLog(["import a.Alpha;", "import o.OtherUtil;", "import t.TicketHelper;"], false));
  const e = compare(r.dir, "base-sandbox-qa", TICKET, rb);
  ok("passes", e.pass, e.markdown);
}

console.log("\ncompare: resolution drops a ticket line");
{
  const r = importScenario("dropped");
  const rb = resolveBranch(r, TICKET, SERVICE(["import a.Alpha;", "import o.OtherUtil;"], "        return TicketHelper.round(a * 2);"));
  const e = compare(r.dir, "base-sandbox-qa", TICKET, rb);
  ok("fails nothing_lost", !e.pass && !e.checks.nothing_lost, JSON.stringify(e.checks));
  ok("names the lost import", e.files[0].lost.includes("import t.TicketHelper;"), JSON.stringify(e.files[0].lost));
}

console.log("\ncompare: a justified line is not lost");
{
  const r = importScenario("justified");
  const rb = resolveBranch(r, TICKET, SERVICE(["import a.Alpha;", "import o.OtherUtil;"], "        return TicketHelper.round(a * 2);"));
  const rec = path.join(ROOT, "justified.json");
  fs.writeFileSync(rec, JSON.stringify({ resolved: [{ file: "FeeService.java", class: "mechanical", rationale: "x" }], justified: [{ file: "FeeService.java", line: "import t.TicketHelper;", reason: "covered by a wildcard import on the target" }] }));
  const e = compare(r.dir, "base-sandbox-qa", TICKET, rb, rec);
  ok("passes", e.pass, e.markdown);
}

console.log("\ncompare: leftover conflict markers");
{
  const r = importScenario("markers");
  const rb = resolveBranch(r, TICKET, BOTH.replace("import o.OtherUtil;", "<<<<<<< HEAD\nimport o.OtherUtil;\n=======\n>>>>>>> base-sandbox-qa"));
  const e = compare(r.dir, "base-sandbox-qa", TICKET, rb);
  ok("fails no_markers", !e.pass && !e.checks.no_markers, JSON.stringify(e.checks));
}

console.log("\ncompare: unrecorded edits beyond the ticket");
{
  const r = importScenario("foreign");
  const rb = resolveBranch(r, TICKET, BOTH.replace('"fee label"', '"changed while resolving"'));
  const e = compare(r.dir, "base-sandbox-qa", TICKET, rb);
  ok("fails nothing_foreign in the conflicted file", !e.pass && !e.checks.nothing_foreign, JSON.stringify(e.checks));

  r.write("Other.java", "class Other { int sneaky; }\n");
  r.commit("unrelated edit on the resolve branch");
  const e2 = compare(r.dir, "base-sandbox-qa", TICKET, rb);
  ok("fails same_files for a file the ticket never touched", !e2.checks.same_files, JSON.stringify(e2.checks));

  const rec = path.join(ROOT, "foreign.json");
  fs.writeFileSync(rec, JSON.stringify({ resolved: [{ file: "FeeService.java", class: "semantic", rationale: "confirmed by developer" }, { file: "Other.java", class: "mechanical", rationale: "post-merge fix" }] }));
  const e3 = compare(r.dir, "base-sandbox-qa", TICKET, rb, rec);
  ok("passes once both are recorded, and still shows them", e3.pass && e3.markdown.includes("(recorded)"), e3.markdown);
}

console.log("\ncompare: ticket branch moved on after the resolution");
{
  const r = importScenario("behind");
  const rb = resolveBranch(r, TICKET, BOTH);
  r.git("switch", "-q", TICKET);
  r.write("Extra.java", "class Extra { int reviewFix; }\n");
  r.commit("GSIS-1: review fix");
  const e = compare(r.dir, "base-sandbox-qa", TICKET, rb);
  ok("fails contains_ticket_head", !e.pass && !e.checks.contains_ticket_head, JSON.stringify(e.checks));
  r.git("switch", "-q", rb);
  r.git("merge", "-q", "--no-edit", TICKET);
  const e2 = compare(r.dir, "base-sandbox-qa", TICKET, rb);
  ok("passes after merging the ticket branch in again", e2.pass, e2.markdown);
}

console.log("\ncompare: target moved on after the resolution");
{
  const r = importScenario("target-moved");
  const rb = resolveBranch(r, TICKET, BOTH);
  r.git("switch", "-q", "base-sandbox-qa");
  r.write("Later.java", "class Later { int otherTeam; }\n");
  r.commit("GSIS-3: merged later");
  const e = compare(r.dir, "base-sandbox-qa", TICKET, rb);
  ok("still passes (compares with the target commit that was merged)", e.pass, e.markdown);
}

console.log("\nname");
{
  const r = importScenario("name");
  let n = name(r.dir, TICKET, "origin/base-sandbox-qa");
  ok("standard name, no suffix", n.next === TICKET + "-base-sandbox-qa-conflict-resolved" && n.existing.length === 0, JSON.stringify(n));
  resolveBranch(r, TICKET, BOTH);
  n = name(r.dir, TICKET, "base-sandbox-qa");
  ok("finds the existing branch and offers -2", n.existing.length === 1 && n.next === n.base + "-2", JSON.stringify(n));
}

fs.rmSync(ROOT, { recursive: true, force: true });
console.log("\n" + (failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"));
process.exit(failures === 0 ? 0 : 1);
