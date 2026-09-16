---
name: jira-attachments
description: How the harness reads a Jira ticket's attachments - list them, download them through the read-only Atlassian MCP, turn screen recordings into still frames, and hand images and frames to the Analyzer as evidence. No per-developer setup, tokens or installs. Use whenever a ticket has attachments, which is nearly always.
---

# Jira attachments

Screen recordings and screenshots are often the best evidence a ticket has. They show the exact screen, the data, the toast that appeared or the notification that didn't. The harness reads them on every ticket that has them. It never analyzes a ticket with its attachments silently skipped.

Only the **orchestrator** (the `/work` or `/analyze` session) fetches attachments, because subagents do not have the Atlassian MCP tools. The Analyzer reads the files the orchestrator prepared.

## Nothing to set up

- **Access** uses the developer's existing Atlassian MCP login. `jira-guard` allows exactly two operations through `executeRead`: `downloadJiraIssueAttachment` and `listJiraIssueComments`.
- **Video frames** use ffmpeg. The script uses ffmpeg if it's on PATH. If not, it installs a pinned `ffmpeg-static` once per machine under `~/.claude-harness/tools/`, which needs Node and npm (already prerequisites) and network access to the npm registry. It needs no admin rights and nothing by hand.

The script is `scripts/attachments.js` in this skill's directory. Run it as `node "<this skill's base directory>/scripts/attachments.js" …`.

## Steps

1. **List.** Call `getJiraIssue` with `fields: ["attachment"]` and `fieldsByKeys: true`. Each entry has `id` (numeric), `filename`, `size` and `mimeType`. The media UUIDs inside the description HTML are **not** attachment IDs.
2. **Choose what to fetch:**

   | Type | Action |
   |---|---|
   | `video/*` | download, then extract frames |
   | `image/png`, `jpeg`, `gif`, `webp` | download; the Analyzer reads it directly |
   | `application/pdf`, `text/*`, `.log`, `.json`, `.csv` | download; the Analyzer reads it directly |
   | `image/svg+xml` under 5 KB | skip (Jira emoji and status icons) |
   | anything else, or over 300 MB | don't fetch; list it as unread |

3. **Download each one**, promptly and one at a time, because the URL expires within minutes:
   - `executeRead({ cloudId, name: "downloadJiraIssueAttachment", inputs: { attachmentId } })` returns a `downloadUrl`.
   - `node attachments.js download <TICKET> "<filename>" '<downloadUrl>'`. This saves to the ticket's local folder and prints `{file, bytes}`. Check `bytes` against the attachment's `size`.
   - Ignore the `downloadCommand` the MCP suggests. The script checks the host, avoids needing curl, and never prints the tokenised URL.
   - If the download fails with HTTP 401/403/410, the URL expired. Request a new one once.
4. **Frames.** For each video, run `node attachments.js frames <TICKET> "<filename>"`.
   - It writes `<name>.frames/` with up to 40 JPEGs named by timestamp (`f07-01m12.4s.jpg`), plus `index.md`.
   - Frames are taken just after each on-screen change settles, plus the first and last frame, and at least one every 10 s.
   - It prints the absolute frame paths.
5. **Hand off.** Give the Analyzer the absolute paths of the images, documents and frame folders, with each file's original filename and what the ticket says it shows ("Refer the below attachment" under Issue 1, …).

## What the Analyzer does with them

- Read the frames in order and note what each step of the reproduction shows. Cite `<filename> @ 01:12` in `analysis.md` under **Attachments**.
- Compare the recording with the written steps. A mismatch goes in the analysis: different screen, different data, a step the text leaves out, or a different environment in the address bar.
- Record the **environment and build** the recording was made on when visible (URL host, date on the taskbar). Whether a later fix is already in that environment often depends on it.
- Frames can miss something shown for under ~1 s, and there is no audio. Say so when a conclusion depends on a brief toast.

## Privacy — what never leaves the machine

Recordings show real names, email addresses, student records and other people's browser tabs.

- Attachments and frames stay in `<os tmp>/claude-harness/jira-attachments/<TICKET>/`. **Never copy them into `sis-brain`, a product repo, a PR, or a Jira comment.**
- The brain records **observations only** ("frame @ 01:15: applicant's notification panel shows no deletion notification"). It never records personal data read off the screen: names, emails, IDs, phone numbers. Refer to people by role ("the applicant", "the HOD").
- Never write a `downloadUrl` anywhere; it carries a token.
- `node attachments.js clean <TICKET>` removes the local copies. Run it when the ticket is closed. Leaving them until then is fine: the folder is machine-local.

## When it cannot be done

If listing, downloading or frame extraction fails, carry on with the analysis. Put the failure under **Attachments** in `analysis.md`: which file, what failed, and the exact error. When the root cause depends on what a recording would show, raise it as an Open Question. Never describe an attachment you did not read.
