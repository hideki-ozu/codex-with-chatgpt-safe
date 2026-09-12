# C2C Safe Markdown Handoff Protocol

This fork keeps the original split of responsibilities:

- **Codex executes**: edit, shell, tests, git, recovery.
- **ChatGPT plans and reviews**: it reads the workspace through the read-only MCP connector.
- **ChatGPT → Codex results are never extracted from the ChatGPT web UI.**
  The result crosses the boundary only as a Markdown file that the user explicitly downloads.
- **Codex → ChatGPT prompts** may still be typed through the supported in-app browser.

The manual Download click is a deliberate trust boundary. Codex must not click the
Download button, copy assistant text, read assistant-message DOM, scrape the accessibility
tree, OCR the answer, intercept network responses, or read the clipboard to obtain ChatGPT output.

## Data paths

```text
Codex --visible prompt--> ChatGPT Web
  ^                         |
  |                         | read-only MCP
  |                         v
  |                    local workspace
  |
  +-- local .md file <-- user clicks Download
```

ChatGPT still reads code, git diffs, test metadata, and released command output through
the existing MCP connector. Repository contents do not need to be pasted into the chat.

## States

```text
INIT → PLAN → EXECUTING → EXECUTED → REVIEW → PLAN | DONE | BLOCKED | ERROR
```

| State | Producer | Transport |
| --- | --- | --- |
| INIT | Codex | visible ChatGPT prompt |
| PLAN | ChatGPT | user-downloaded Markdown |
| EXECUTING | Codex | local only |
| EXECUTED | Codex | visible ChatGPT prompt |
| REVIEW | ChatGPT | implicit while it inspects via MCP |
| DONE | ChatGPT | user-downloaded Markdown |
| BLOCKED | ChatGPT | user-downloaded Markdown |
| ERROR | either | local/browser error handling |
| HANDOFF | Codex | visible ChatGPT prompt |

There is no `STATE: RESUME`. Local checkpoint state remains in the C2C session file.

## Markdown handoff format

Every ChatGPT → Codex result must be created as a downloadable UTF-8 Markdown file.
The file starts with this YAML-like frontmatter:

```yaml
---
protocol: c2c
task_id: c2c_f81a
state: PLAN
iteration: 1
---
```

Valid handoff states are:

- `VERIFY` — one-time workspace identity check
- `PLAN` — executable next-step plan
- `REVIEW` — optional review-only report
- `DONE` — success criteria are satisfied
- `BLOCKED` — ChatGPT needs a user decision or unavailable prerequisite

The canonical filename is:

```text
c2c-<task_id>-<state-lowercase>-<iteration>.md
```

Examples:

```text
c2c-setup-verify-0.md
c2c-c2c_f81a-plan-1.md
c2c-c2c_f81a-done-3.md
```

Browsers may append a duplicate suffix to a downloaded filename. The receiver validates
the frontmatter, so the protocol does not trust the filename alone.

## Receiving a handoff

After asking ChatGPT to create a handoff file, Codex immediately waits on the **local**
Downloads directory:

```bash
c2c handoff wait -w <workspace> \
  --task c2c_f81a \
  --states PLAN,DONE,BLOCKED \
  --json
```

For an exact first plan:

```bash
c2c handoff wait -w <workspace> \
  --task c2c_f81a \
  --iteration 1 \
  --states PLAN \
  --json
```

If the browser downloads somewhere else, set either:

```bash
C2C_DOWNLOADS_DIR=/path/to/downloads
```

or pass:

```bash
--downloads /path/to/downloads
```

On Windows, the default is the current user's `Downloads` folder. Under WSL, explicitly
point `--downloads` or `C2C_DOWNLOADS_DIR` at the Windows Downloads directory when needed.

When a valid file appears, the CLI:

1. reads the local file,
2. validates `protocol`, `task_id`, `state`, and `iteration`,
3. moves it to `<workspace>/.c2c/inbox/`,
4. returns the parsed local body to Codex.

Malformed, unrelated, stale, and partially downloaded files are ignored while waiting.

## Workspace verification

Do not verify the workspace by reading a ChatGPT reply from the page.

Send this request instead:

```text
Use the "<connectorName>" connector.
Call workspace_info and read a harmless top-level hello-style file.
Create a downloadable Markdown file named c2c-setup-verify-0.md.

The file must be:
---
protocol: c2c
task_id: setup
state: VERIFY
iteration: 0
---

Put the workspace name and the harmless filename you read in the body.
Do not rely on Codex reading your chat response.
```

Then the user clicks **Download** and Codex runs:

```bash
c2c handoff wait -w <workspace> \
  --task setup \
  --iteration 0 \
  --states VERIFY \
  --json
```

Codex compares the **local file body** with the expected workspace identity.

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
Create a downloadable Markdown handoff named c2c-c2c_f81a-plan-1.md.
Use protocol=c2c, task_id=c2c_f81a, state=PLAN, iteration=1.
Put rationale, concrete actions, likely files, tests, and success criteria in the file.
Do not rely on Codex reading your chat response.
```

## PLAN file (ChatGPT → Codex)

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

Plans must be finite, concrete, and executable.

## EXECUTED (Codex → ChatGPT)

Before sending EXECUTED, Codex records execution metadata:

```bash
c2c record -w <workspace> \
  --task c2c_f81a \
  --iteration 1 \
  --changed-files "src/a.ts,src/b.ts" \
  --tests "27 passed" \
  --exit-status ok
```

When a test/build/lint/typecheck produced useful output, Codex may nominate that local
output through the existing sanitized `execution_output` path.

Then Codex sends:

```text
[C2C]
STATE: EXECUTED
TASK_ID: c2c_f81a
ITERATION: 1

RESULT:
Execution finished.

Please independently inspect the workspace and current git diff through MCP.
If another iteration is required, create a PLAN handoff file.
If the task is complete, create a DONE handoff file.
If blocked, create a BLOCKED handoff file.

Use the same task_id. Do not rely on Codex reading your chat response.
```

Codex then waits locally:

```bash
c2c handoff wait -w <workspace> \
  --task c2c_f81a \
  --states PLAN,DONE,BLOCKED \
  --json
```

## DONE file

```markdown
---
protocol: c2c
task_id: c2c_f81a
state: DONE
iteration: 3
---

# Summary
...

# Verification
...
```

## BLOCKED file

```markdown
---
protocol: c2c
task_id: c2c_f81a
state: BLOCKED
iteration: 3
---

# Reason
...

# Needs
...
```

## HANDOFF to a replacement ChatGPT conversation

HANDOFF remains a small visible prompt. It carries task history, not source files:

```text
[C2C]
STATE: HANDOFF
TASK_ID: c2c_f81a
ITERATION: 4

ORIGINAL_GOAL:
Implement dark mode with a persisted user preference.

PROGRESS:
- Iter 1-2: theme context + toggle implemented and reviewed.

CURRENT_STATE:
EXECUTED

KNOWN_ISSUES:
...

NEXT_EXPECTED_STEP:
Review the current diff via MCP and create the next downloadable C2C Markdown handoff.
```

The new ChatGPT conversation re-reads current code through MCP.

## Boot prompt

Send this once at the start of a C2C conversation:

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
6. ChatGPT-to-Codex results must be downloadable C2C Markdown handoff files.
7. Never rely on Codex reading your visible chat response.
8. Use the exact filename, task_id, state, and iteration requested by Codex.
9. Keep the visible chat response minimal; the Markdown file is the authoritative result.
10. If you receive HANDOFF, re-read needed code through MCP and continue from NEXT_EXPECTED_STEP.
```

## Loop limits

`maxIterations` remains configurable in `.c2c.json` (default 12). At the limit,
Codex pauses and asks the user whether to continue.

## Security boundary

The safe fork intentionally keeps these operations manual or local:

- **Manual:** clicking ChatGPT's Download control.
- **Local automation:** watching Downloads, validating the Markdown, moving it into
  `.c2c/inbox`, parsing it, executing the plan.
- **Forbidden to the Skill:** extracting assistant output from ChatGPT DOM, clipboard,
  screenshots/OCR, accessibility tree, hidden/private endpoints, or network interception.

This boundary is intentional even when browser automation could technically click Download.
