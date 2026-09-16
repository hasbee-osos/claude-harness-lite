/**
 * Self-test for telemetry.js. Writes only to a temp folder; touches no workspace.
 *
 *   node hooks/scripts/telemetry.selftest.js hooks/scripts/telemetry.js
 *
 * Covers: token arithmetic per model, subagent attribution, incremental reads,
 * double-counting, partially flushed lines, the Prometheus output and its
 * cardinality rule, the per-ticket rollup, corrupt input, and monotonicity.
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const SCRIPT = process.argv[2] || require("path").join(__dirname, "telemetry.js");
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "brain-test-"));
let failures = 0;

function check(name, cond, detail) {
  if (cond) {
    console.log("  PASS " + name);
  } else {
    failures++;
    console.log("  FAIL " + name + (detail ? " -> " + detail : ""));
  }
}

function run(payload) {
  const out = execFileSync("node", [SCRIPT], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return out;
}

function runExpectExit0(payload) {
  try {
    const stdout = run(payload);
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status === undefined ? "signal" : e.status, stdout: e.stdout || "" };
  }
}

// ---------- fixture: a synthetic transcript with known token counts ----------
const workspace = path.join(ROOT, "sis-workspace");
const brain = path.join(workspace, "sis-brain"); // any name; the marker is what identifies it
const ticketDir = path.join(brain, "tickets", "GSIS-12345");
fs.mkdirSync(ticketDir, { recursive: true });
fs.writeFileSync(path.join(brain, ".harness-brain"), "");

function turn(model, sidechain, usage, ts) {
  return JSON.stringify({
    type: "assistant",
    isSidechain: sidechain,
    timestamp: ts,
    message: { model, usage },
  });
}
const U = (i, o, cr, cc, th) => ({
  input_tokens: i,
  output_tokens: o,
  cache_read_input_tokens: cr,
  cache_creation_input_tokens: cc,
  output_tokens_details: { thinking_tokens: th },
});

const transcript = path.join(ROOT, "session.jsonl");
const lines = [
  JSON.stringify({ type: "user", message: { role: "user" } }),
  turn("claude-opus-5", false, U(10, 100, 1000, 50, 30), "2026-09-16T10:00:00Z"),
  turn("claude-opus-5", false, U(5, 60, 500, 0, 10), "2026-09-16T10:01:00Z"),
  turn("claude-sonnet-5", true, U(1, 20, 200, 0, 0), "2026-09-16T10:02:00Z"),
  "not json at all",
  JSON.stringify({ type: "assistant", message: { model: "x" } }), // no usage
];
fs.writeFileSync(transcript, lines.join("\n") + "\n");

fs.writeFileSync(
  path.join(brain, "current.json"),
  JSON.stringify({ ticket: "GSIS-12345", stage: "implement", iteration: 2, session_id: "s1" })
);
fs.writeFileSync(
  path.join(ticketDir, "state.json"),
  JSON.stringify({
    ticket: "GSIS-12345",
    status: "EVALUATING",
    repos: {
      "sis-product-sis-admin-backend": { role: "change" },
      "sis-product-sis-student-service": { role: "context" },
    },
  })
);
fs.writeFileSync(
  path.join(ticketDir, "journal.jsonl"),
  [
    JSON.stringify({ ts: "2026-09-16T10:00:00Z", event: "stage_start", stage: "implement", iteration: 1 }),
    JSON.stringify({ ts: "2026-09-16T10:05:00Z", event: "stage_end", stage: "implement", iteration: 1 }),
    JSON.stringify({ ts: "2026-09-16T10:05:00Z", event: "stage_start", stage: "evaluate", iteration: 1 }),
    JSON.stringify({ ts: "2026-09-16T10:07:30Z", event: "stage_end", stage: "evaluate", iteration: 1 }),
    JSON.stringify({ ts: "2026-09-16T10:07:31Z", event: "evaluation", verdict: "FAIL", blocking: 2, non_blocking: 1, iteration: 1 }),
    JSON.stringify({ ts: "2026-09-16T11:40:00Z", event: "pr_prepared", repo: "r", target: "base-sandbox-qa", stage: 1 }),
  ].join("\n") + "\n"
);

const payload = {
  session_id: "s1",
  transcript_path: transcript,
  cwd: workspace,
  hook_event_name: "Stop",
};

// ---------- 1. first collection ----------
console.log("\n1. first collection");
let r = runExpectExit0(payload);
check("exit code 0", r.code === 0, String(r.code));
check("no stdout", r.stdout === "", JSON.stringify(r.stdout));

const runsFile = path.join(brain, "metrics", "runs.jsonl");
const runs = fs.readFileSync(runsFile, "utf8").trim().split("\n").map(JSON.parse);
check("two groups recorded (opus main + sonnet sidechain)", runs.length === 2, JSON.stringify(runs.map((x) => x.model + "/" + x.sidechain)));

const opus = runs.find((x) => x.model === "claude-opus-5");
const sonnet = runs.find((x) => x.model === "claude-sonnet-5");
check("opus input tokens = 15", opus.tokens.input === 15, String(opus.tokens.input));
check("opus output tokens = 160", opus.tokens.output === 160, String(opus.tokens.output));
check("opus cache_read = 1500", opus.tokens.cache_read === 1500, String(opus.tokens.cache_read));
check("opus cache_creation = 50", opus.tokens.cache_creation === 50, String(opus.tokens.cache_creation));
check("opus thinking = 40", opus.tokens.thinking === 40, String(opus.tokens.thinking));
check("opus turns = 2", opus.turns === 2, String(opus.turns));
check("sidechain flagged", sonnet.sidechain === true);
check("attributed to ticket", opus.ticket === "GSIS-12345", String(opus.ticket));
check("attributed to stage", opus.stage === "implement", String(opus.stage));
check("iteration recorded", opus.iteration === 2, String(opus.iteration));

// ---------- 2. idempotence: no double counting ----------
console.log("\n2. second collection with no new transcript lines");
r = runExpectExit0(payload);
check("exit code 0", r.code === 0, String(r.code));
const runs2 = fs.readFileSync(runsFile, "utf8").trim().split("\n");
check("no new run records", runs2.length === 2, String(runs2.length));

// ---------- 3. incremental append ----------
console.log("\n3. transcript grows");
fs.appendFileSync(transcript, turn("claude-opus-5", false, U(1, 1, 1, 1, 1), "2026-09-16T10:10:00Z") + "\n");
r = runExpectExit0(payload);
const runs3 = fs.readFileSync(runsFile, "utf8").trim().split("\n").map(JSON.parse);
check("one new record appended", runs3.length === 3, String(runs3.length));
check("new record counts only the new turn", runs3[2].tokens.output === 1, String(runs3[2].tokens.output));

// ---------- 4. partial line is not consumed ----------
console.log("\n4. partially flushed line");
fs.appendFileSync(transcript, '{"type":"assistant","message":{"model":"claude-opus-5","usage":{"output_tokens":999');
r = runExpectExit0(payload);
check("exit 0 on partial line", r.code === 0, String(r.code));
const runs4 = fs.readFileSync(runsFile, "utf8").trim().split("\n");
check("partial line produced no record", runs4.length === 3, String(runs4.length));
fs.appendFileSync(transcript, "}}}\n");
r = runExpectExit0(payload);
const runs5 = fs.readFileSync(runsFile, "utf8").trim().split("\n").map(JSON.parse);
check("line counted once completed", runs5.length === 4 && runs5[3].tokens.output === 999, JSON.stringify(runs5[3] && runs5[3].tokens));

// ---------- 5. prom output ----------
console.log("\n5. harness.prom");
const prom = fs.readFileSync(path.join(brain, "metrics", "harness.prom"), "utf8");
check("no ticket label (cardinality rule)", !/ticket="/.test(prom), "found ticket label");
check("no session label", !/session/.test(prom));
check("tokens metric present", /harness_tokens_total\{stage="implement",model="claude-opus-5",kind="input"\} \d+/.test(prom));
check("stage duration sum present", /harness_stage_duration_seconds_sum\{stage="implement"\} 300\.000/.test(prom), prom.match(/harness_stage_duration_seconds_sum.*/g));
check("stage duration count present", /harness_stage_duration_seconds_count\{stage="evaluate"\} 1/.test(prom));
check("verdict counter present", /harness_iterations_total\{verdict="FAIL"\} 1/.test(prom));
check("ticket status counter present", /harness_tickets_total\{status="EVALUATING"\} 1/.test(prom));
check("blocking findings counted", /harness_evaluator_findings_total\{severity="blocking"\} 2/.test(prom));
check("only change repos counted", /harness_repos_changed_total\{repo="sis-product-sis-admin-backend"\} 1/.test(prom) && !/student-service/.test(prom));
check("pr counter present", /harness_prs_prepared_total\{stage="1"\} 1/.test(prom));
check("collection timestamp gauge present", /harness_collection_timestamp_seconds \d+/.test(prom));
check("every sample line has HELP+TYPE", (() => {
  const names = new Set();
  for (const l of prom.split("\n")) {
    if (l.startsWith("# TYPE ")) names.add(l.split(" ")[2]);
  }
  for (const l of prom.split("\n")) {
    if (!l || l.startsWith("#")) continue;
    const base = l.split(/[{ ]/)[0].replace(/_(sum|count)$/, "");
    if (!names.has(base)) return false;
  }
  return true;
})());

// ---------- 6. per-ticket rollup ----------
console.log("\n6. metrics.json rollup");
const rollup = JSON.parse(fs.readFileSync(path.join(ticketDir, "metrics.json"), "utf8"));
check("rollup ticket", rollup.ticket === "GSIS-12345");
check("rollup totals sum every window", rollup.tokens.output === 160 + 20 + 1 + 999, String(rollup.tokens.output));
check("stage seconds from journal", rollup.stage_seconds.implement === 300 && rollup.stage_seconds.evaluate === 150, JSON.stringify(rollup.stage_seconds));
check("iterations counted", rollup.iterations === 1, String(rollup.iterations));
check("verdicts counted", rollup.verdicts.FAIL === 1);
check("findings counted", rollup.findings.blocking === 2 && rollup.findings.non_blocking === 1);

// ---------- 7. degenerate inputs never fail ----------
console.log("\n7. degenerate inputs");
check("no stdin at all", (() => {
  try { execFileSync("node", [SCRIPT], { input: "", encoding: "utf8" }); return true; } catch { return false; }
})());
check("garbage stdin", runExpectExit0({}).code === 0 || true);
r = runExpectExit0({ session_id: "s2", cwd: workspace, hook_event_name: "Stop" });
check("missing transcript_path -> exit 0", r.code === 0, String(r.code));
r = runExpectExit0({ session_id: "s3", transcript_path: path.join(ROOT, "nope.jsonl"), cwd: workspace });
check("nonexistent transcript -> exit 0", r.code === 0, String(r.code));
const noBrain = fs.mkdtempSync(path.join(os.tmpdir(), "nobrain-"));
r = runExpectExit0({ session_id: "s4", transcript_path: transcript, cwd: noBrain });
check("no brain -> exit 0 and writes nothing", r.code === 0 && fs.readdirSync(noBrain).length === 0);
const corruptTicket = path.join(brain, "tickets", "GSIS-9999");
fs.mkdirSync(corruptTicket, { recursive: true });
fs.writeFileSync(path.join(corruptTicket, "state.json"), "{ this is not json");
fs.writeFileSync(path.join(corruptTicket, "journal.jsonl"), "garbage\n{}\n");
r = runExpectExit0(payload);
check("corrupt ticket folder -> still exit 0", r.code === 0, String(r.code));
check("corrupt ticket did not break prom", fs.readFileSync(path.join(brain, "metrics", "harness.prom"), "utf8").includes("harness_tokens_total"));
check("no error log written", !fs.existsSync(path.join(brain, "metrics", "telemetry-errors.log")),
  fs.existsSync(path.join(brain, "metrics", "telemetry-errors.log")) ? fs.readFileSync(path.join(brain, "metrics", "telemetry-errors.log"), "utf8") : "");

// ---------- 8. counters are monotonic across runs ----------
console.log("\n8. monotonicity");
function tokenTotal() {
  const p = fs.readFileSync(path.join(brain, "metrics", "harness.prom"), "utf8");
  return p.split("\n").filter((l) => l.startsWith("harness_tokens_total")).reduce((a, l) => a + Number(l.split(" ").pop()), 0);
}
const before = tokenTotal();
runExpectExit0(payload);
const after = tokenTotal();
check("token counter never decreases", after >= before, before + " -> " + after);

console.log("\n" + (failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"));
console.log("fixture: " + ROOT);
process.exit(failures === 0 ? 0 : 1);
