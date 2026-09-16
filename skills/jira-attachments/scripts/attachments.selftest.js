/**
 * Self-test for the frame selection in attachments.js. Pure logic: no ffmpeg, no network.
 *
 *   node skills/jira-attachments/scripts/attachments.selftest.js
 */
"use strict";
const { selectTimestamps } = require("./attachments.js");

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log(`  PASS ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail ? "\n        " + detail : ""}`);
  }
}
const increasing = (ts) => ts.every((t, i) => i === 0 || t > ts[i - 1]);
const maxGap = (ts) => ts.reduce((m, t, i) => (i ? Math.max(m, t - ts[i - 1]) : m), 0);

console.log("\nStatic recording (no scene changes)");
let ts = selectTimestamps([], 30);
check("first frame at 0", ts[0] === 0, JSON.stringify(ts));
check("last frame near the end", Math.abs(ts[ts.length - 1] - 29.7) < 0.01, JSON.stringify(ts));
check("no gap over 10s", maxGap(ts) <= 10, JSON.stringify(ts));

console.log("\nA burst of changes collapses to its settled state");
ts = selectTimestamps([5.0, 5.2, 5.5, 5.9], 12);
check("one frame for the burst, after it settles", ts.includes(6.3), JSON.stringify(ts));
check("no frame mid-burst", !ts.some((t) => t > 5 && t < 6.3), JSON.stringify(ts));

console.log("\nSeparate changes each get a frame");
ts = selectTimestamps([3, 8, 20], 25);
check("three settled frames", [3.4, 8.4, 20.4].every((x) => ts.includes(x)), JSON.stringify(ts));
check("strictly increasing", increasing(ts), JSON.stringify(ts));

console.log("\nCap on long, busy recordings");
const busy = Array.from({ length: 400 }, (_, i) => i * 2 + 1);
ts = selectTimestamps(busy, 820);
check("at most 40 frames", ts.length <= 40, "got " + ts.length);
check("keeps first and last", ts[0] === 0 && Math.abs(ts[ts.length - 1] - 819.7) < 0.01, `${ts[0]} … ${ts[ts.length - 1]}`);
check("strictly increasing", increasing(ts));

console.log("\nEdge cases");
ts = selectTimestamps([0.2, 0.3], 0.8);
check("very short clip stays within duration", ts.every((t) => t >= 0 && t <= 0.8), JSON.stringify(ts));
ts = selectTimestamps([50, -1, 999], 60);
check("out-of-range scene times ignored", ts.every((t) => t >= 0 && t <= 59.7), JSON.stringify(ts));

console.log("\n" + (failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"));
process.exit(failures === 0 ? 0 : 1);
