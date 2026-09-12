---
name: chatgpt-world-image
description: >
  Generate an image in ChatGPT Web after reading a specified GitHub repository
  to understand its world setting/canon, then using an explicitly attached local
  prompt file as the scene/image-generation instruction. Use when the user wants
  illustrations, covers, concept art, character scenes, locations, props, or other
  images that must stay consistent with a GitHub-hosted fictional world or project
  setting. Do not give ChatGPT direct access to the Ubuntu local repository.
---

# ChatGPT World-Context Image Generation

Use ChatGPT Web to generate an image from two deliberately separate sources:

1. **GitHub repository = canonical world context**
2. **Attached Ubuntu file = the image-generation prompt for this run**

The GitHub repository supplies setting, characters, locations, technology,
terminology, visual rules, chronology, and other canon. The local attachment
supplies the concrete scene/image request.

This skill does **not** give ChatGPT Web direct access to the Ubuntu repository.

## Hard boundaries

1. Read world/canon information only from the user-specified GitHub repository,
   branch/commit, and paths, plus public web material only when the user explicitly
   allows it.
2. Attach only the prompt/reference files explicitly selected by the user.
3. Never expose the Ubuntu local repository, local git metadata, `.env*`, SSH keys,
   API tokens, browser profiles, cookies, cloud credentials, password databases,
   or other secret-bearing files.
4. Never substitute the local checkout for the GitHub source, even if the same
   repository is present locally.
5. Never read ChatGPT assistant output from the DOM, accessibility tree,
   screenshots/OCR, clipboard, hidden endpoints, or network traffic.
6. Never automate a ChatGPT Download button click.
7. For a private GitHub repository, use only an official connected GitHub
   app/connector available to ChatGPT Web. Never paste a PAT, SSH key, session
   cookie, or other credential into ChatGPT.
8. The attached prompt file is authoritative for this requested image. Repository
   canon constrains interpretation unless the prompt explicitly says it is an
   intentional alternate-universe/non-canon override.

## Prerequisites

- A logged-in ChatGPT Web session is available in the Ubuntu headless Chromium
  environment.
- ChatGPT Web has image-generation capability in the active session.
- The browser can attach the selected Ubuntu prompt/reference file(s).
- For private repositories, ChatGPT has access through an official GitHub
  connector/app.
- `c2c` is available when a Markdown sidecar/result handoff is desired.

The codex-with-chatgpt checkout lives at: `<ACTUAL_CHECKOUT_PATH>`

Let `<checkout>` mean that path. Run:

```bash
node "<checkout>/bin/c2c.js" <command>
```

or use `c2c` directly when globally linked.

## Inputs

Resolve these values from the user request:

- `WORLD_REPOSITORY`: GitHub URL or `owner/repo`.
- `WORLD_REF`: optional branch, tag, or commit SHA. Preserve an explicit commit SHA
  exactly so the image can be reproduced against the same canon snapshot.
- `WORLD_PATHS`: optional user-selected canon folders/files.
- `PROMPT_FILE`: one explicitly selected Ubuntu file containing the requested
  scene/image prompt. Markdown, text, YAML, JSON, or another ChatGPT-readable
  document is acceptable.
- `REFERENCE_FILES`: optional explicitly selected images/documents that visually
  constrain the output.
- `OUTPUT_INTENT`: e.g. novel illustration, cover, concept art, character sheet,
  location art, prop design, realistic photo style, anime illustration.
- `OUTPUT_DESTINATION`: optional Google Drive folder when the user wants the final
  artifact saved there and ChatGPT can perform that save through an official
  connected Drive action.

If any local path is relative, resolve it on Ubuntu before opening ChatGPT.

## Local preflight

For `PROMPT_FILE` and each `REFERENCE_FILE`:

1. Resolve the canonical path.
2. Confirm it exists and is a regular file.
3. Record basename, extension, and size.
4. Reject obvious credential/secret files.
5. Do not paste the entire file body into the ChatGPT composer. Attach the file
   through the browser file-input path instead.

Do not archive a directory or repository as a convenience shortcut.

## Start a fresh image-generation conversation

Prefer a new ChatGPT conversation for each independent image-generation request.
Reuse a prior image thread only when the user explicitly wants iterative visual
continuity from that thread.

Attach `PROMPT_FILE` first. Attach `REFERENCE_FILES` only when provided.
Confirm only that the expected filenames are visibly attached before sending.
Do not inspect future assistant-response content through automation.

Generate an id such as `image_f81a`.

## Phase 1 — Understand the GitHub world canon

Ask ChatGPT to inspect `WORLD_REPOSITORY` before generating anything.

For a public repository, direct ChatGPT to the canonical GitHub URL.
For a private repository, direct it to use its connected official GitHub
app/connector.

Instruct ChatGPT to build an internal canon model by prioritizing, when present:

1. explicit world-setting / lore documents,
2. character sheets and appearance descriptions,
3. location and architecture descriptions,
4. technology / magic / social rules,
5. chronology and era constraints,
6. visual/style guides,
7. README / index / table-of-contents files that point to relevant material.

Do not ask ChatGPT to exhaustively ingest a huge repository. It should locate and
read only the files needed to interpret the attached image prompt faithfully.

If the repository contains conflicting canon, prefer the most explicit and most
specific source at `WORLD_REF`. If ambiguity materially affects the image, ChatGPT
should choose the least-assumptive interpretation unless the attached prompt
settles it.

## Phase 2 — Treat the attachment as the image prompt

The attached `PROMPT_FILE` is the scene instruction, not merely background
material. Tell ChatGPT to read it completely before generating the image.

Interpretation priority:

1. explicit user instruction in the current request,
2. explicit instructions in `PROMPT_FILE`,
3. canon from the specified GitHub repository/ref,
4. clearly labeled reference files,
5. minimal inference only when none of the above defines a detail.

When the prompt and canon differ:

- If the prompt explicitly requests an AU/non-canon deviation, follow the prompt.
- Otherwise preserve canon and resolve vague prompt wording in the canon-consistent
  direction.
- Never silently invent major character traits, faction symbols, technologies,
  costumes, locations, or era details that contradict repository canon.

## Prompt template

Send one concise instruction like this after the attachments are present:

```text
Use ChatGPT image generation for this task.

WORLD CANON SOURCE:
GitHub repository: <WORLD_REPOSITORY>
Ref: <WORLD_REF or default branch>
Relevant paths, if specified: <WORLD_PATHS or none>

First inspect that GitHub source and read only the repository files needed to
understand the world setting relevant to this image. For a private repository,
use the connected official GitHub app/connector. Do not use or request my Ubuntu
local repository.

IMAGE PROMPT:
The attached file `<PROMPT_FILE basename>` is the authoritative image-generation
prompt for this run. Read it completely. The other attached files, if any, are
reference material only.

CANON RULE:
Keep characters, locations, technology/magic, terminology, era, clothing,
architecture, symbols, and other setting details consistent with the GitHub canon
unless the attached prompt explicitly requests a non-canon/AU override.

TASK:
Generate the image now. Do not merely describe a possible image or return only a
rewritten prompt.

OUTPUT INTENT:
<OUTPUT_INTENT>

Do not rely on automated reading of your visible response.
```

Do not include local filesystem paths in the ChatGPT prompt beyond attachment
basenames unless the user specifically wants them disclosed.

## Image generation

After submitting the prompt:

1. Let ChatGPT inspect the GitHub source and attached file(s).
2. Let ChatGPT invoke its normal image-generation capability.
3. Do not scrape progress text or the completed assistant response.
4. Do not OCR or screenshot-read the generated result to infer completion.
5. Do not click the image Download button automatically.

If ChatGPT asks a normal product confirmation for a connected GitHub/Drive action,
allow the user to approve it. Never bypass the confirmation.

## Saving the generated image

Use one of these paths, in order:

### A. Official Google Drive action, when actually available for the generated image

If the active ChatGPT session can save/upload the generated image itself through
an official connected Google Drive action, ask it to save the final image to the
user-selected `OUTPUT_DESTINATION` with a deterministic filename such as:

```text
image-<task-id>-1.png
```

Do not claim success until the normal ChatGPT/Drive action reports the save in the
visible UI or the user confirms it. Do not scrape that confirmation text.

### B. Manual Download fallback

If ChatGPT cannot directly save the generated image to Drive, leave the generated
image visible and tell the user to use ChatGPT's normal Download control manually.
Codex must not click Download automatically.

## Optional metadata sidecar

When the user wants reproducibility, ask ChatGPT to also create a C2C Markdown
sidecar after image generation. The sidecar is metadata only; it is not a copy of
ChatGPT's visible prose.

Suggested frontmatter:

```yaml
---
protocol: c2c
task_id: image_f81a
state: DONE
iteration: 1
artifact_type: image
---
```

Suggested body:

```markdown
# World source
- Repository: <repo>
- Ref: <ref>
- Canon files consulted: <paths>

# Prompt source
- Attachment: <filename>

# Generation
- Intent: <cover / illustration / concept art / ...>
- Canon overrides: <none or explicit overrides>
- Output filename: <filename if known>
```

For a headless Ubuntu setup, use the configured C2C handoff backend for this
sidecar:

```bash
c2c handoff status -w <workspace> --json
c2c handoff wait -w <workspace> --task <task-id> --states DONE,BLOCKED --json
```

The sidecar must never be used as a substitute for retrieving the image itself.

## BLOCKED cases

Stop rather than inventing a workaround when:

- the GitHub repository is private and unavailable through ChatGPT's connected
  GitHub app/connector,
- `PROMPT_FILE` cannot be attached/read,
- the requested prompt file appears to contain credentials or secrets,
- ChatGPT image generation is unavailable in the active session,
- a required canon ambiguity cannot reasonably be resolved and the user must
  decide,
- the requested image cannot be generated under the active product/safety rules.

When possible, return a C2C `BLOCKED` sidecar explaining only the actionable
reason.

## Success criteria

The workflow is successful when:

- ChatGPT read the specified GitHub source rather than the Ubuntu local checkout,
- the selected prompt attachment was used as the concrete image instruction,
- the generated image reflects the relevant repository canon,
- no secret-bearing local data was uploaded,
- the final image is either saved through an official supported destination action
  or left for explicit manual Download,
- no ChatGPT assistant output was programmatically extracted from the page.
