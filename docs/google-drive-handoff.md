# Google Drive handoff on a headless Ubuntu Server

This is the recommended setup when ChatGPT runs on a Windows PC but Codex/C2C
executes on a separate Ubuntu Server with no GUI.

## Architecture

```text
ChatGPT Web
   |
   | official Google Drive app/action
   v
Google Drive / C2C-Handoff / inbox
   |
   | rclone (Ubuntu)
   v
C2C local state inbox
   |
   +--> Codex
```

No ChatGPT response text is scraped from the web page.

## 1. Connect Google Drive in ChatGPT

Connect the official Google Drive app in ChatGPT and allow the write/create action
needed to save handoff files. A write action may show a normal confirmation in
ChatGPT; approve it normally. C2C never bypasses confirmations.

Create these folders in My Drive:

```text
C2C-Handoff/
├── inbox/
└── processed/
```

ChatGPT writes only to `inbox`. Ubuntu moves successfully consumed files to
`processed`.

## 2. Install rclone on Ubuntu

Install `rclone` using your preferred Ubuntu package or the official rclone
installation method.

Verify:

```bash
rclone version
```

## 3. Authorize Google Drive from a headless server

Run:

```bash
rclone config
```

Create a Google Drive remote, for example `gdrive`.

Because the server has no GUI, follow rclone's headless/remote authorization flow.
The browser authorization can be completed on your Windows PC, then the resulting
authorization is returned to the Ubuntu configuration flow.

Verify access:

```bash
rclone lsf gdrive:C2C-Handoff/inbox
```

## 4. Configure C2C per workspace

```bash
c2c handoff configure \
  -w /path/to/project \
  --backend google-drive \
  --remote gdrive:C2C-Handoff/inbox \
  --archive-remote gdrive:C2C-Handoff/processed
```

Check it:

```bash
c2c handoff status -w /path/to/project --check --json
```

Expected shape:

```json
{
  "ok": true,
  "config": {
    "backend": "google-drive"
  },
  "chatgptFolder": "C2C-Handoff/inbox",
  "check": {
    "ok": true
  }
}
```

## 5. Runtime behavior

When Codex asks ChatGPT for a PLAN, ChatGPT is instructed to save for example:

```text
C2C-Handoff/inbox/c2c-c2c_f81a-plan-1.md
```

The file contains:

```yaml
---
protocol: c2c
task_id: c2c_f81a
state: PLAN
iteration: 1
---
```

Ubuntu waits with:

```bash
c2c handoff wait \
  -w /path/to/project \
  --task c2c_f81a \
  --iteration 1 \
  --states PLAN \
  --json
```

The receiver:

1. lists the Drive inbox through `rclone`,
2. downloads a candidate into C2C's private staging directory,
3. validates the C2C frontmatter,
4. stores the accepted local copy in C2C state,
5. moves the Drive source to `processed`,
6. returns the parsed local body to Codex.

## Local fallback

To return to the manual Download backend:

```bash
c2c handoff configure \
  -w /path/to/project \
  --backend local \
  --downloads /path/to/Downloads
```

The rest of the protocol stays the same.
