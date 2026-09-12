---
name: chatgpt-file-review
description: >
  Review one or more explicitly selected files from the Ubuntu host by attaching
  them to the logged-in ChatGPT Web session in a headless Chromium browser.
  Use when the user asks ChatGPT Web to review local files, documents, source
  files, configs, logs, or generated artifacts. Do not use this skill to expose
  an entire local repository to ChatGPT.
---

# ChatGPT Local File Review

Use ChatGPT Web as an independent reviewer for explicitly selected files that
exist on this Ubuntu host.

This skill is intentionally **file-scoped**. It does not give ChatGPT Web direct
access to the local repository or workspace.

## Hard boundaries

1. Upload only files the user explicitly selected or files that are an obvious,
   necessary part of the same requested review.
2. Do not recursively upload directories or an entire repository unless the user
   explicitly asks for that different workflow.
3. Never upload credential-like or secret-bearing files, including `.env*`, SSH
   keys, API tokens, browser profiles, cookie stores, password databases, cloud
   credentials, or files under common secret directories. If the requested file
   appears sensitive, stop and ask the user before uploading it.
4. Never read ChatGPT assistant output from the DOM, accessibility tree,
   screenshots/OCR, clipboard, hidden endpoints, or network traffic.
5. Never automate a ChatGPT Download click.
6. ChatGPT Web must not be given direct MCP/workspace access for this workflow.
   The attached file(s) are the only local content ChatGPT may inspect.

## Prerequisites

- A logged-in ChatGPT Web session is available in the Ubuntu headless Chromium
  environment.
- The browser can attach a local Ubuntu file to ChatGPT Web.
- `c2c` is available for the result handoff.

The codex-with-chatgpt checkout lives at: `<ACTUAL_CHECKOUT_PATH>`

Let `<checkout>` mean that path. Run:

```bash
node "<checkout>/bin/c2c.js" <command>
```

or use `c2c` directly when globally linked.

## Input

Resolve these values from the user request:

- `FILES`: one or more absolute Ubuntu file paths.
- `REVIEW_GOAL`: what ChatGPT should evaluate.
- `REVIEW_CRITERIA`: optional focus areas such as correctness, security,
  maintainability, technical writing, API design, bugs, consistency, or style.

If a relative path is given, resolve it locally before opening ChatGPT.

## Local preflight

For every file:

1. Resolve the canonical path.
2. Confirm it exists and is a regular file.
3. Record filename, extension, and size.
4. Reject obvious credential/secret files before browser upload.
5. Do not print file contents into the ChatGPT prompt; the file itself is the
   transport.

If multiple files are requested, attach them separately when the ChatGPT UI
supports it. Do not create a repository archive as a convenience shortcut.

## Start the review

Use the existing authenticated ChatGPT Web browser session. Prefer a new ChatGPT
conversation for an independent review unless the user explicitly asks to continue
an existing review thread.

Attach the selected local files through the browser file-upload control. The
browser process and the files are both on the Ubuntu host, so use the native file
chooser / file-input automation rather than copying bytes into the prompt.

Before submitting, confirm only that the expected attachment filenames are shown.
Do not inspect assistant response content later.

Generate a task id such as `review_f81a`.

Run:

```bash
c2c handoff status -w <workspace> --json
```

For headless Ubuntu, `google-drive` is the preferred result backend. If the
backend is `local`, explain that the user must perform the Download action
manually; do not click it automatically.

## Prompt template

Send this with the attachments:

```text
You are performing an independent review of the attached file(s).

REVIEW GOAL:
<REVIEW_GOAL>

FOCUS:
<REVIEW_CRITERIA or "correctness, risks, maintainability, and concrete improvements">

Rules:
1. Review only the attached files and the information in this request.
2. Do not assume access to my local workspace or repository.
3. Identify findings with the exact attached filename and, when possible, the
   relevant symbol/section/line context.
4. Separate confirmed defects from suggestions and uncertainties.
5. Prioritize findings by severity: critical, high, medium, low.
6. Give concrete remediation steps, not generic advice.
7. If the evidence is insufficient, say what is missing rather than guessing.

Return the authoritative result as a C2C Markdown file with:
---
protocol: c2c
task_id: <TASK_ID>
state: REVIEW
iteration: 1
---

Use this body structure:
# Review summary
# Findings
# Recommended changes
# Verification ideas
# Uncertainties

<BACKEND-SPECIFIC RETURN INSTRUCTION>
Do not rely on Codex reading your visible chat response.
```

### Google Drive return instruction

Use the `chatgptFolder` returned by `c2c handoff status`:

```text
Use your connected official Google Drive app/action to save the Markdown file as:
c2c-<TASK_ID>-review-1.md
inside:
<chatgptFolder>
The Drive file is the authoritative result.
```

Allow normal ChatGPT product confirmation for the Drive write if one appears.
Never bypass it.

### Local return instruction

```text
Create a downloadable Markdown file named:
c2c-<TASK_ID>-review-1.md
The downloadable file is the authoritative result.
```

Tell the user to click Download when it appears. Codex must not click it.

## Receive the result

Run:

```bash
c2c handoff wait \
  -w <workspace> \
  --task <TASK_ID> \
  --iteration 1 \
  --states REVIEW,BLOCKED \
  --json
```

Use only the returned LOCAL parsed body as the review result.

If the state is `BLOCKED`, surface the missing prerequisite without scraping the
ChatGPT page.

## Follow-up review

For a follow-up after the user changes the file:

- use a new iteration number,
- attach the new file version again,
- state exactly what changed or what should be rechecked,
- receive a new `REVIEW` handoff.

Do not assume ChatGPT still has the latest local file unless it is attached again.

## Completion

Return to the user:

- the review summary,
- the most important findings,
- the local filenames reviewed,
- any limitations or missing context.

Do not modify the reviewed files unless the user separately asks for changes.
