#!/usr/bin/env node
/**
 * Jira attachments for the harness: download into a machine-local folder and turn screen
 * recordings into a small set of still frames an agent can read.
 *
 *   node attachments.js dir      <TICKET>                    print (and create) the local folder
 *   node attachments.js download <TICKET> <filename> <url>   save a Jira download URL there
 *   node attachments.js frames   <TICKET> <video-file>       extract frames + index.md
 *   node attachments.js clean    <TICKET>                    delete the ticket's local folder
 *
 * Files live under <os tmp>/claude-harness/jira-attachments/<TICKET>/ — never in the brain or
 * a product repo, because recordings show real names, emails and student data.
 *
 * ffmpeg is resolved in this order: $HARNESS_FFMPEG, `ffmpeg` on PATH, then a pinned
 * ffmpeg-static package installed once per machine under ~/.claude-harness/tools/.
 * Developers install nothing by hand.
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const FFMPEG_STATIC_VERSION = "5.2.0";
const MAX_FRAMES = 40;
const SCENE_THRESHOLD = 0.03; // low on purpose: UI changes (toasts, dialogs) are small
const CLUSTER_GAP_S = 1.5;    // scene changes closer than this are one on-screen change
const SETTLE_S = 0.4;         // capture just after a change, once the screen has settled
const MAX_GAP_S = 10;         // add a frame when nothing changed for this long
const ALLOWED_HOSTS = [/\.atlassian\.com$/i, /\.atlassian\.net$/i, /\.atl-paas\.net$/i];

function fail(msg) {
  console.error("attachments: " + msg);
  process.exit(1);
}

function ticketDir(ticket) {
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(ticket || "")) fail("ticket must look like GSIS-123, got " + ticket);
  const dir = path.join(os.tmpdir(), "claude-harness", "jira-attachments", ticket);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeName(name) {
  const base = path.basename(String(name || "")).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim();
  if (!base || base === "." || base === "..") fail("invalid filename " + name);
  return base;
}

// ---------- download ----------

async function download(ticket, filename, url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    fail("not a URL");
  }
  if (u.protocol !== "https:" || !ALLOWED_HOSTS.some((re) => re.test(u.hostname))) {
    fail("refusing to download from " + u.hostname + " (only Atlassian hosts are allowed)");
  }
  const out = path.join(ticketDir(ticket), safeName(filename));
  const res = await fetch(u, { redirect: "follow" });
  if (!res.ok) fail(`download failed: HTTP ${res.status} (the URL is short-lived; request a new one)`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(out, buf);
  // Never print the URL: it carries a token.
  console.log(JSON.stringify({ file: out, bytes: buf.length }));
}

// ---------- ffmpeg ----------

function works(bin) {
  const r = spawnSync(bin, ["-version"], { encoding: "utf8" });
  return r.status === 0;
}

function resolveFfmpeg() {
  if (process.env.HARNESS_FFMPEG && works(process.env.HARNESS_FFMPEG)) return process.env.HARNESS_FFMPEG;
  if (works("ffmpeg")) return "ffmpeg";

  const toolDir = path.join(os.homedir(), ".claude-harness", "tools", "ffmpeg-static-" + FFMPEG_STATIC_VERSION);
  const pkgDir = path.join(toolDir, "node_modules", "ffmpeg-static");
  const bin = path.join(pkgDir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  if (fs.existsSync(bin) && works(bin)) return bin;

  console.error(`attachments: ffmpeg not found; installing ffmpeg-static@${FFMPEG_STATIC_VERSION} once into ${toolDir} (~80 MB)`);
  fs.mkdirSync(toolDir, { recursive: true });
  // One command string through the shell: npm is a .cmd shim on Windows, and Node refuses
  // to spawn those without a shell. toolDir is built above from os.homedir(), never user input.
  const npm = spawnSync(
    `npm install --prefix "${toolDir}" --no-audit --no-fund --no-save --loglevel error ffmpeg-static@${FFMPEG_STATIC_VERSION}`,
    { stdio: ["ignore", "ignore", "inherit"], shell: true }
  );
  if (npm.status !== 0) fail("npm install of ffmpeg-static failed; check network access to the npm registry");
  // Newer npm versions may skip install scripts; the binary is fetched by the package's install.js.
  if (!fs.existsSync(bin)) {
    spawnSync(process.execPath, [path.join(pkgDir, "install.js")], { cwd: pkgDir, stdio: ["ignore", "ignore", "inherit"] });
  }
  if (!fs.existsSync(bin) || !works(bin)) fail("ffmpeg-static installed but no working binary for " + process.platform + "/" + process.arch);
  return bin;
}

// ---------- frame selection (pure; covered by attachments.selftest.js) ----------

/**
 * From scene-change timestamps and the video duration, choose when to grab frames:
 * the first frame, the settled state after each burst of changes, gap fillers for long
 * quiet stretches, and the last frame. Capped at maxFrames, keeping first and last.
 */
function selectTimestamps(sceneTimes, duration, opts = {}) {
  const maxFrames = opts.maxFrames || MAX_FRAMES;
  const end = Math.max(0, duration - 0.3);
  const clamp = (t) => Math.min(Math.max(0, t), end);

  const sorted = [...sceneTimes].filter((t) => t > 0 && t < duration).sort((a, b) => a - b);
  const settled = [];
  let clusterLast = null;
  for (const t of sorted) {
    if (clusterLast !== null && t - clusterLast >= CLUSTER_GAP_S) settled.push(clamp(clusterLast + SETTLE_S));
    clusterLast = t;
  }
  if (clusterLast !== null) settled.push(clamp(clusterLast + SETTLE_S));

  let times = [0, ...settled, end].sort((a, b) => a - b);

  const filled = [];
  for (let i = 0; i < times.length; i++) {
    if (i > 0) {
      const gap = times[i] - times[i - 1];
      const extra = Math.floor(gap / MAX_GAP_S);
      for (let k = 1; k <= extra; k++) {
        const t = times[i - 1] + (gap * k) / (extra + 1);
        filled.push(t);
      }
    }
    filled.push(times[i]);
  }

  times = [];
  for (const t of filled) {
    if (times.length === 0 || t - times[times.length - 1] >= 0.5) times.push(t);
  }
  if (times.length && end - times[times.length - 1] > 0 && end - times[times.length - 1] < 0.5) {
    times[times.length - 1] = end;
  }

  if (times.length > maxFrames) {
    const picked = [];
    for (let i = 0; i < maxFrames; i++) {
      picked.push(times[Math.round((i * (times.length - 1)) / (maxFrames - 1))]);
    }
    times = [...new Set(picked)];
  }
  return times.map((t) => Math.round(t * 1000) / 1000);
}

function fmt(t) {
  const m = Math.floor(t / 60);
  const s = (t - m * 60).toFixed(1).padStart(4, "0");
  return `${String(m).padStart(2, "0")}m${s}s`;
}

// ---------- frames ----------

function frames(ticket, videoArg) {
  const dir = ticketDir(ticket);
  const video = path.isAbsolute(videoArg) ? videoArg : path.join(dir, videoArg);
  if (!fs.existsSync(video)) fail("video not found: " + video);
  const ffmpeg = resolveFfmpeg();

  const probe = spawnSync(
    ffmpeg,
    ["-hide_banner", "-i", video, "-vf", `select='gt(scene\\,${SCENE_THRESHOLD})',showinfo`, "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  const log = probe.stderr || "";
  const dm = log.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!dm) fail("could not read the video duration (is it a video file?)");
  const duration = +dm[1] * 3600 + +dm[2] * 60 + +dm[3];
  const sceneTimes = [...log.matchAll(/pts_time:([0-9.]+)/g)].map((x) => parseFloat(x[1]));

  const outDir = path.join(dir, path.basename(video).replace(/\.[^.]+$/, "") + ".frames");
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const times = selectTimestamps(sceneTimes, duration);
  const rows = [];
  times.forEach((t, i) => {
    const file = `f${String(i + 1).padStart(2, "0")}-${fmt(t)}.jpg`;
    const r = spawnSync(
      ffmpeg,
      ["-hide_banner", "-loglevel", "error", "-ss", String(t), "-i", video, "-frames:v", "1",
        "-vf", "scale='min(1280\\,iw)':-2", "-q:v", "3", "-y", path.join(outDir, file)],
      { encoding: "utf8" }
    );
    if (r.status === 0 && fs.existsSync(path.join(outDir, file))) rows.push({ file, t });
  });

  const index = [
    `# Frames — ${path.basename(video)}`,
    "",
    `Duration ${fmt(duration)} · ${sceneTimes.length} scene changes detected · ${rows.length} frames kept (max ${MAX_FRAMES}).`,
    "Frames are taken just after each on-screen change settles, plus the first and last frame and one at least every " + MAX_GAP_S + "s.",
    "",
    "| Frame | At |",
    "|---|---|",
    ...rows.map((r) => `| ${r.file} | ${fmt(r.t)} |`),
    ""
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "index.md"), index);

  console.log(JSON.stringify({ video, duration: Math.round(duration * 10) / 10, sceneChanges: sceneTimes.length, framesDir: outDir, frames: rows.map((r) => path.join(outDir, r.file)) }, null, 2));
}

// ---------- main ----------

async function main() {
  const [cmd, ticket, a, b] = process.argv.slice(2);
  switch (cmd) {
    case "dir":
      console.log(ticketDir(ticket));
      break;
    case "download":
      if (!a || !b) fail("usage: download <TICKET> <filename> <url>");
      await download(ticket, a, b);
      break;
    case "frames":
      if (!a) fail("usage: frames <TICKET> <video-file>");
      frames(ticket, a);
      break;
    case "clean":
      fs.rmSync(ticketDir(ticket), { recursive: true, force: true });
      console.log("removed");
      break;
    default:
      fail("usage: dir|download|frames|clean <TICKET> ...");
  }
}

if (require.main === module) {
  main().catch((e) => fail(e.message));
}

module.exports = { selectTimestamps };
