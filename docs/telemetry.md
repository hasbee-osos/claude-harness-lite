# Telemetry

Two independent routes, answering different questions. Run both.

| Route | Answers | Needs |
|---|---|---|
| **Harness metrics** (`hooks/scripts/telemetry.js`, built in) | What does a *ticket* cost? Where does the time go? How often does the evaluator catch something? How many iterations until PASS? | Nothing — it writes files into the brain |
| **Claude Code OTel** (native) | What does the team's Claude Code usage cost overall, per person, per session? | An OTel collector or a Prometheus scrape of the CLI |

The harness route is the one that knows about tickets, stages, repos and verdicts. Native OTel cannot slice by any of those, because it has no idea the harness exists.

---

## 1. Harness metrics

### How it works

`telemetry.js` runs as a hook on `SubagentStop`, `Stop` and `SessionEnd`. On each run it:

1. reads the session transcript from the byte offset it last stopped at (a cursor per session in `sis-brain/metrics/`), so a 10 MB transcript is parsed once, not on every turn, and nothing is counted twice;
2. sums `message.usage` per model, separating subagent turns (`isSidechain`) from the main thread;
3. attributes that window to the ticket, stage and iteration named in `sis-brain/current.json`, which `/work` keeps current;
4. appends the result to `sis-brain/metrics/runs.jsonl`;
5. **recomputes** `sis-brain/metrics/harness.prom` and the ticket's `metrics.json` from the brain — journals for durations and verdicts, `state.json` for status and repos. `metrics.json` keeps tokens per session and replaces only the sessions this machine recorded, so a colleague's sessions on the same ticket are never wiped. When `current.json` has just been cleared, the last ticket this session worked on is rolled up once more, so its final `stage_end` is counted. The file's shape is in `skills/brain/SKILL.md`.

Recomputing rather than incrementing means the counters survive a crash, a killed session or a hand-edited file, and stay monotonic as Prometheus requires. Stage durations come from the journal's `stage_start`/`stage_end` pairs, not from transcript timestamps, so a stage that spans a coffee break is measured honestly.

The hook is written never to interfere: everything is guarded, it writes nothing to stdout, and it always exits 0. If it hits an unexpected error it appends to `sis-brain/metrics/telemetry-errors.log` (capped at 64 KB) and gets out of the way. No brain folder means no telemetry and no complaint.

### Metrics exposed

`sis-brain/metrics/harness.prom` is in Prometheus textfile-collector format:

| Metric | Type | Labels |
|---|---|---|
| `harness_tokens_total` | counter | `stage`, `model`, `kind` (`input`, `output`, `cache_read`, `cache_creation`, `thinking`) |
| `harness_turns_total` | counter | `stage`, `sidechain` |
| `harness_stage_duration_seconds` | summary | `stage` (`_sum` and `_count`) |
| `harness_iterations_total` | counter | `verdict` (`PASS`, `FAIL`, `INSUFFICIENT_EVIDENCE`) |
| `harness_tickets_total` | counter | `status` |
| `harness_evaluator_findings_total` | counter | `severity` (`blocking`, `non_blocking`) |
| `harness_repos_changed_total` | counter | `repo` |
| `harness_prs_prepared_total` | counter | `stage` (PR stage 1 or 2) |
| `harness_collection_timestamp_seconds` | gauge | — |

**Cardinality rule — do not break it.** No `ticket`, `branch`, `session` or file-path label anywhere. Those grow without bound as the workspace accumulates, and unbounded labels are how a Prometheus server falls over. Every label above is bounded: 6 stages, 8 repos, a handful of models, fixed enums. Per-ticket detail belongs in `runs.jsonl` and `metrics.json`, which are files, not time series.

**No content ever leaves.** Counts, durations and enum labels only — no prompts, no code, no ticket text, no file paths.

### Scraping it

Point node_exporter at the metrics folder:

```bash
node_exporter --collector.textfile.directory=/path/to/sis-workspace/sis-brain/metrics
```

Every file ending in `.prom` in that directory is exposed on the node_exporter endpoint and scraped like any other target. Nothing else is needed — no server, no agent, no port to open in the workspace.

For the per-ticket detail (which ticket, which iteration), ship `runs.jsonl` with Promtail into Loki, or read it directly with the Grafana Infinity plugin. It is one JSON object per line:

```json
{"ts":"…","session_id":"…","hook_event":"SubagentStop","ticket":"GSIS-12345","stage":"implement",
 "iteration":2,"model":"claude-opus-5","sidechain":true,"turns":37,
 "tokens":{"input":1450,"output":118069,"cache_read":12699515,"cache_creation":297678,"thinking":29437},
 "first_turn_ts":"…","last_turn_ts":"…"}
```

`runs.jsonl` grows by a couple of lines per turn-window. Rotate it (rename it aside) whenever you like — the Prometheus counters are recomputed from whatever is there, so rotating resets them, which Prometheus handles as a counter reset.

---

## 2. Claude Code's own OpenTelemetry

Claude Code exports its own metrics. Set these in the environment where your team runs Claude:

```bash
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_METRICS_EXPORTER=otlp            # or: prometheus
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_ENDPOINT=http://<collector-host>:4318
OTEL_METRIC_EXPORT_INTERVAL=60000     # ms
OTEL_METRICS_INCLUDE_SESSION_ID=true
```

It emits, among others: `claude_code.token.usage`, `claude_code.cost.usage`, `claude_code.session.count`, `claude_code.active_time.total`, `claude_code.lines_of_code.count`, `claude_code.commit.count`, `claude_code.pull_request.count`.

Two cautions:

- The metric names and attributes above were read from the installed CLI on 2026-09-16. **Re-check them against the official Claude Code monitoring documentation before building dashboards** — they belong to Anthropic, not to this harness, and can change between releases.
- This is telemetry about *people using Claude Code*, not about tickets. Decide deliberately whether to enable it, and tell the team you have: it carries user and session identity in a way the harness metrics deliberately do not.

---

## Dashboard: the panels worth having first

Build these before anything prettier — they are the ones that answer "is the harness worth it?".

1. **First-pass rate** — share of tickets where the evaluator returned `PASS` at iteration 1. `harness_iterations_total{verdict="PASS"}` against the total. The single best quality signal.
2. **Iterations per ticket** — a distribution, not an average. A long tail means the plan is under-specifying, or tickets are running on the light track that should be full.
3. **Escalation rate** — `harness_tickets_total{status="ESCALATED"}` over all tickets. These are the tickets the harness could not finish; read their `escalation-report.md`, not just the number.
4. **Blocking findings per iteration** — `harness_evaluator_findings_total{severity="blocking"}`. If this is near zero on every ticket, the evaluator is not being strict enough; if it never falls between iterations, the implementor is not consuming the findings.
5. **Tokens per ticket** — from `runs.jsonl`. Sanity-check against the manual cost of the same ticket.
6. **Stage duration breakdown** — `harness_stage_duration_seconds_sum` by stage. Shows where the wall-clock actually goes; usually not where people expect.
7. **Repos touched per ticket** — `harness_repos_changed_total`. Confirms whether the multi-repo triage is finding cross-service work or quietly ignoring it.

Read them together with the brain: a metric says a ticket took three iterations, `decisions.md` says why.

---

## Verifying the collector

The collector ships with a self-test. It writes only to a temp folder and touches no workspace:

```bash
node hooks/scripts/telemetry.selftest.js
```

It covers token arithmetic per model, subagent attribution, incremental reads, double counting, partially flushed transcript lines, the Prometheus output and its cardinality rule, the per-ticket rollup, corrupt input, and counter monotonicity. Run it after any change to `telemetry.js`.

Checked against a real 10.7 MB session transcript, the collector's totals match an independent recount exactly, and a full first parse takes about 230 ms; subsequent runs read only the new bytes.
