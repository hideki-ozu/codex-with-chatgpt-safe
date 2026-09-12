# C2C Safe Markdown Handoff Protocol

This fork keeps the original split of responsibilities:

- **Codex executes**: edit, shell, tests, git, recovery.
- **ChatGPT plans and reviews**: it reads the workspace through the read-only MCP connector.
- **ChatGPT → Codex results are never scraped from the ChatGPT web UI.**
- **Codex → ChatGPT prompts** may still be typed through the supported in-app browser.

C2C supports two safe return transports:

1. **google-drive** (recommended for a remote/headless Linux executor): ChatGPT itself
   uses its connected **official Google Drive app/action** to save the Markdown file into
   a configured Drive folder. Ubuntu receives it with `rclone`.
2. **local** (fallback): ChatGPT creates a downloadable Markdown file and the user
   explicitly clicks **Download**. Codex watches only the local filesystem.

Neither backend permits Codex to read assistant-message DOM, accessibility output,
screenshots/OCR, clipboard content, hidden endpoints, or ChatGPT network responses.
Codex must never automate the ChatGPT Download click.

## Data paths

### Google Drive backend

```text
Codex --visible prompt--> ChatGPT Web
  ^                         | \
  |                         |  \ official Google Drive app/action
  | read-only MCP           |   v
  |                         | Google Drive/C2C-Handoff/inbox
  |                         |   |
  |                         |   | rclone
  |                         v   v
  +-------------------- Ubuntu Server
                         local C2C inbox
```

### Local fallback

```text
Codex --visible prompt--> ChatGPT Web
  ^                         |
  |                         | read-only MCP
  |                         v
  |                    workspace
  |
  +-- local .md file <-- user clicks Download
```

## Configure the handoff backend

Configuration is stored per workspace in the C2C state directory, not in the project.

### Google Drive

First configure `rclone` on the Linux executor so a Drive remote such as `gdrive:`
works. Then:

```bash
c2c handoff configure -w <workspace> \
  --backend google-drive \
  --remote gdrive:C2C-Handoff/inbox \
  --archive-remote gdrive:C2C-Handoff/processed
```

Verify:

```bash
c2c handoff status -w <workspace> --check --json
```

The JSON includes `chatgptFolder`, for example:

```json
{
  "config": { "backend": "google-drive" },
  "chatgptFolder": "C2C-Handoff/inbox"
}
```

That is the folder ChatGPT should target through its connected Google Drive app.

### Local

```bash
c2c handoff configure -w <workspace> \
  --backend local \
  --downloads /path/to/Downloads
```

## States

```text
INIT → PLAN → EXECUTING → EXECUTED → REVIEW → PLAN | DONE | BLOCKED | ERROR
```

| State | Producer | Return transport |
| --- | --- | --- |
| INIT | Codex | visible ChatGPT prompt |
| PLAN | ChatGPT | Drive file or manual-download file |
| EXECUTING | Codex | local only |
| EXECUTED | Codex | visible ChatGPT prompt |
| REVIEW | ChatGPT | implicit while it inspects via MCP |
| DONE | ChatGPT | Drive file or manual-download file |
| BLOCKED | ChatGPT | Drive file or manual-download file |
| ERROR | either | local/browser error handling |
| HANDOFF | Codex | visible ChatGPT prompt |

There is no `STATE: RESUME`. Local checkpoint state remains in the C2C session file.

## Markdown handoff format

Every ChatGPT → Codex result is a UTF-8 Markdown file beginning with:

```yaml
---
protocol: c2c
task_id: c2c_f81a
state: PLAN
iteration: 1
---
```

Valid handoff states:

- `VERIFY` — workspace identity check
- `PLAN` — executable next-step plan
- `REVIEW` — optional review-only report
- `DONE` — success criteria are satisfied
- `BLOCKED` — a user decision or unavailable prerequisite is required

Canonical filename:

```text
c2c-<task_id>-<state-lowercase>-<iteration>.md
```

Examples:

```text
c2c-setup-verify-0.md
c2c-c2c_f81a-plan-1.md
c2c-c2c_f81a-done-3.md
```

The receiver validates frontmatter and never trusts only the filename.

## Asking ChatGPT to return a handoff

Before every ChatGPT → Codex result, read:

```bash
c2c handoff status -w <workspace> --json
```

### If backend = google-drive

Tell ChatGPT:

```text
Create the requested C2C Markdown file with the exact filename and frontmatter.
Use your connected Google Drive app/action to save the file directly into:
<chatgptFolder>

Do not rely on Codex reading your visible chat response.
The Google Drive file is the authoritative result.
```

ChatGPT may require a normal product confirmation for the Drive write action. That is
allowed; do not bypass it.

Then Codex waits only on Drive:

```bash
c2c handoff wait -w <workspace> \
  --task c2c_f81a \
  --states PLAN,DONE,BLOCKED \
  --json
```

The Ubuntu-side receiver:

1. lists the configured Drive inbox with `rclone`,
2. copies a candidate to a local staging area,
3. validates `protocol`, `task_id`, `state`, and `iteration`,
4. moves the accepted file into the local C2C state inbox,
5. optionally moves the Drive source into the configured processed/archive folder,
6. returns the parsed local body to Codex.

### If backend = local

Ask ChatGPT to create the exact downloadable Markdown file. Tell the user to click
**Download** when it appears, then run the same `c2c handoff wait` command.

## Workspace verification

Never verify the workspace by reading a ChatGPT reply from the page.

Use task `setup`, state `VERIFY`, iteration `0`:

```text
Use the "<connectorName>" connector.
Call workspace_info and read a harmless top-level hello-style file.

Create c2c-setup-verify-0.md with:
---
protocol: c2c
task_id: setup
state: VERIFY
iteration: 0
---

Put the workspace name and harmless filename in the body.
Return it through the configured C2C handoff backend.
Do not rely on Codex reading your visible chat response.
```

Then:

```bash
c2c handoff wait -w <workspace> \
  --task setup \
  --iteration 0 \
  --states VERIFY \
  --json
```

Codex compares the LOCAL received file body with the expected workspace identity.

## INIT (Codex → ChatGPT)

```text
[C2C]
STATE: INIT
TASK_ID: c2c_f81a
ITERATION: 0

GOAL:
Implement dark mode.

INSTRUCTION:
Inspect the connected workspace through the Codex with ChatGPT MCP connector.
Create c2c-c2c_f81a-plan-1.md with protocol=c2c, task_id=c2c_f81a,
state=PLAN, iteration=1.
Put rationale, concrete actions, likely files, tests, and success criteria in the file.
Return it through the configured C2C handoff backend.
Do not rely on Codex reading your visible chat response.
```

## PLAN file

```markdown
---
protocol: c2c
task_id: c2c_f81a
state: PLAN
iteration: 1
---

# Goal
...

# Rationale
...

# Actions
1. ...
2. ...

# Files likely involved
...

# Tests
...

# Success criteria
...
```

## EXECUTED (Codex → ChatGPT)

Record execution metadata first:

```bash
c2c record -w <workspace> \
  --task c2c_f81a \
  --iteration 1 \
  --changed-files "src/a.ts,src/b.ts" \
  --tests "27 passed" \
  --exit-status ok
```

Then send:

```text
[C2C]
STATE: EXECUTED
TASK_ID: c2c_f81a
ITERATION: 1

RESULT:
Execution finished.

Independently inspect the workspace, git diff, tests, and any released execution output
through MCP.

If more work is needed, create a PLAN Markdown handoff.
If complete, create a DONE Markdown handoff.
If blocked, create a BLOCKED Markdown handoff.

Return exactly one result file through the configured C2C handoff backend.
Do not rely on Codex reading your visible chat response.
```

Then:

```bash
c2c handoff wait -w <workspace> \
  --task c2c_f81a \
  --states PLAN,DONE,BLOCKED \
  --json
```

## Boot prompt

```text
You are the planning and review layer of a Codex coding session.

Codex owns execution.
You own high-level reasoning, planning, and review.

You can read the current local workspace through the "Codex with ChatGPT" MCP connector.

Rules:
1. Do not ask Codex to paste files that are available through MCP.
2. Inspect only files needed for the task.
3. Use MCP to inspect current code, git status, diffs, tests, and released execution output.
4. Produce concise, executable plans and independent reviews.
5. Never assume execution succeeded merely because Codex says so.
6. ChatGPT-to-Codex results must be C2C Markdown handoff files.
7. Return each handoff through the transport specified by Codex:
   - google-drive: save it with the connected official Google Drive app/action.
   - local: create it as a downloadable file for the user.
8. Never rely on Codex reading your visible chat response.
9. Use the exact filename, task_id, state, and iteration requested by Codex.
10. If you receive HANDOFF, re-read needed code through MCP and continue from NEXT_EXPECTED_STEP.
```

## Security boundary

Allowed:

- ChatGPT's connected official Google Drive app/action writing the handoff file.
- Ubuntu `rclone` reading the user's own Drive folder.
- User manually clicking Download in local fallback mode.
- Local parsing, validation, archival, and execution after the file reaches the user's
  own filesystem or Drive.

Forbidden to the Skill:

- assistant-message DOM extraction,
- accessibility-tree extraction of assistant output,
- screenshots/OCR of the answer,
- clipboard extraction,
- hidden/private ChatGPT endpoints,
- ChatGPT network interception,
- automated Download clicks.

The return path is intentionally independent from ChatGPT page scraping.
