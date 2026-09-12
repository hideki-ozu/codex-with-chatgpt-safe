---
name: chatgpt-github-review
description: >
  Ask ChatGPT Web to review code or design by reading a GitHub repository,
  branch, commit, file, issue, or pull request from GitHub itself. Use when the
  user wants an independent ChatGPT review of GitHub-hosted content without
  exposing the Ubuntu local repository to ChatGPT Web.
---

# ChatGPT GitHub Repository Review

Use ChatGPT Web as an independent reviewer of content hosted on GitHub.

This workflow is intentionally **GitHub-scoped**. ChatGPT must inspect the
GitHub-hosted repository or PR, not the Ubuntu local checkout.

## Hard boundaries

1. Do not attach local repository files for this workflow.
2. Do not give ChatGPT direct access to the Ubuntu workspace or local MCP bridge.
3. Do not paste GitHub credentials, PATs, SSH keys, browser cookies, or other
   authentication material into ChatGPT.
4. Public repositories may be reviewed from their GitHub URL.
5. Private repositories may be reviewed only when ChatGPT has access through an
   official connected GitHub app/connector. If it cannot access the repository,
   stop with `BLOCKED`; do not work around permissions by leaking local files.
6. Never read ChatGPT assistant output from the DOM, accessibility tree,
   screenshots/OCR, clipboard, hidden endpoints, or network traffic.
7. Never automate a ChatGPT Download click.

## Prerequisites

- A logged-in ChatGPT Web session is available in the Ubuntu headless Chromium
  environment.
- `c2c` is available for result handoff.
- The repository target is represented by a GitHub URL or `owner/repo` plus an
  optional branch, commit, PR, issue, or path.

The codex-with-chatgpt checkout lives at: `<ACTUAL_CHECKOUT_PATH>`

Let `<checkout>` mean that path. Run:

```bash
node "<checkout>/bin/c2c.js" <command>
```

or use `c2c` directly when globally linked.

## Input

Resolve:

- `REPOSITORY`: GitHub URL or `owner/repo`.
- `TARGET`: optional branch, tag, commit SHA, PR number, issue, or file/path.
- `REVIEW_GOAL`: what the user wants evaluated.
- `REVIEW_CRITERIA`: optional focus areas.

Prefer a stable GitHub target. If the user gives a commit SHA or PR, preserve it
exactly. If only a branch is given, tell ChatGPT which branch to inspect.

Do not substitute the local checkout for the GitHub source even when both exist.

## Choose access mode

### Public GitHub repository

Give ChatGPT the canonical GitHub URL and instruct it to inspect the repository
from GitHub/web sources.

### Private GitHub repository

Instruct ChatGPT to use its connected official GitHub app/connector. If the
repository is not visible through that connection, request a `BLOCKED` handoff.
Do not ask the user for a token in chat.

## Start the review

Prefer a new ChatGPT conversation for an independent review unless the user asks
to continue a prior GitHub review.

Generate a task id such as `ghreview_f81a`.

Run:

```bash
c2c handoff status -w <workspace> --json
```

For headless Ubuntu, `google-drive` is the preferred result backend. If the
backend is `local`, the user must perform the Download action manually.

## Prompt template

Send:

```text
You are performing an independent review of a GitHub-hosted codebase.

REPOSITORY:
<REPOSITORY>

TARGET:
<TARGET or "default branch">

REVIEW GOAL:
<REVIEW_GOAL>

FOCUS:
<REVIEW_CRITERIA or "correctness, architecture, risks, maintainability, and concrete improvements">

Source rules:
1. Inspect the GitHub-hosted repository/PR/commit itself.
2. Do not assume access to my Ubuntu local checkout or local workspace.
3. For a public repository, use the GitHub URL/web access.
4. For a private repository, use only the connected official GitHub app/connector.
5. Do not ask for passwords, PATs, SSH keys, cookies, or other credentials.
6. State which branch/commit/PR you actually reviewed when that information is available.
7. Ground findings in concrete GitHub paths, symbols, PR hunks, or commits.
8. Separate confirmed problems from suggestions and uncertainties.
9. Prioritize findings by severity: critical, high, medium, low.
10. If GitHub access or evidence is insufficient, return BLOCKED instead of guessing.

For a successful review, return the authoritative result as a C2C Markdown file:
---
protocol: c2c
task_id: <TASK_ID>
state: REVIEW
iteration: 1
---

Use this body structure:
# Scope reviewed
# Review summary
# Findings
# Recommended changes
# Verification ideas
# Uncertainties

For an access failure, return:
---
protocol: c2c
task_id: <TASK_ID>
state: BLOCKED
iteration: 1
---

Explain exactly what GitHub access or source information is missing.

<BACKEND-SPECIFIC RETURN INSTRUCTION>
Do not rely on Codex reading your visible chat response.
```

### Google Drive return instruction

Use the `chatgptFolder` returned by `c2c handoff status`:

```text
Use your connected official Google Drive app/action to save exactly one result file.
Successful review filename:
c2c-<TASK_ID>-review-1.md
Blocked filename:
c2c-<TASK_ID>-blocked-1.md
Save it inside:
<chatgptFolder>
The Drive file is the authoritative result.
```

Allow normal ChatGPT product confirmation for the Drive write if one appears.
Never bypass it.

### Local return instruction

```text
Create exactly one downloadable result file.
Successful review filename:
c2c-<TASK_ID>-review-1.md
Blocked filename:
c2c-<TASK_ID>-blocked-1.md
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

## Review quality rules

A good review should include concrete references such as:

- `src/foo.ts` / symbol names,
- PR filenames and changed areas,
- specific configuration keys,
- tests that should exist or be changed,
- architectural dependencies visible in the GitHub source.

Do not accept a generic review that could have been written without looking at
the repository. If the result lacks concrete GitHub evidence, ask ChatGPT for a
new review iteration and require paths/symbols/commit context.

## Follow-up review

For a later review:

- use the same task id with a new iteration when continuing the same review,
- explicitly state the new GitHub commit/PR state to inspect,
- never assume GitHub content is unchanged,
- receive the next `REVIEW` or `BLOCKED` handoff through the same backend.

## Completion

Return to the user:

- the GitHub target actually reviewed,
- the review summary,
- the highest-priority findings,
- important file/path references,
- any access or evidence limitations.

Do not edit the Ubuntu local repository unless the user separately asks for an
implementation step.
