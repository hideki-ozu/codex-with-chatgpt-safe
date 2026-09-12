# Optional ChatGPT Web review skills

These skills are optional and independent from the main `skill/SKILL.md` C2C
coding workflow.

They are intended for the Ubuntu headless-browser setup where ChatGPT Web is
already reachable with an authenticated Chromium session.

**Important:** neither review pattern gives ChatGPT Web direct access to the
Ubuntu repository. These review-only workflows do not require the workspace MCP
bridge/tunnel just to provide the review source:

- local-file review sends only explicitly selected files as ChatGPT attachments;
- GitHub review asks ChatGPT to inspect GitHub-hosted content itself.

The existing C2C handoff is used only to bring the review result back safely.

## 1. `chatgpt-file-review`

Use when ChatGPT should review one or more explicitly selected files that exist
on the Ubuntu host.

Data path:

```text
Ubuntu file(s)
    ↓ browser attachment
ChatGPT Web
    ↓ C2C REVIEW handoff
Google Drive (recommended) or manual Download
    ↓
Ubuntu / Codex
```

Important: this skill is file-scoped. It does **not** give ChatGPT Web direct
access to the Ubuntu repository.

Install:

```bash
mkdir -p ~/.codex/skills
cp -R skills/chatgpt-file-review ~/.codex/skills/
```

Then replace `<ACTUAL_CHECKOUT_PATH>` inside the installed `SKILL.md` with the
actual path to this repository checkout.

Typical request:

```text
ChatGPT Webを使って /home/me/project/docs/design.md をレビューして。
設計上の矛盾と抜けを重点的に見て。
```

## 2. `chatgpt-github-review`

Use when ChatGPT should inspect and review content hosted on GitHub while the
Ubuntu local checkout remains private from ChatGPT Web.

Data path:

```text
GitHub repository / PR / commit
    ↓ ChatGPT Web GitHub/web access
ChatGPT Web
    ↓ C2C REVIEW handoff
Google Drive (recommended) or manual Download
    ↓
Ubuntu / Codex
```

For private repositories, ChatGPT must already have access through an official
connected GitHub app/connector. The skill never asks for PATs, passwords, SSH
keys, or browser cookies.

Install:

```bash
mkdir -p ~/.codex/skills
cp -R skills/chatgpt-github-review ~/.codex/skills/
```

Then replace `<ACTUAL_CHECKOUT_PATH>` inside the installed `SKILL.md` with the
actual path to this repository checkout.

Typical requests:

```text
ChatGPT Webで https://github.com/OWNER/REPO を読んで、アーキテクチャをレビューして。
```

```text
ChatGPT Webで OWNER/REPO の PR #123 をレビューして。
重大な不具合の可能性を優先して。
```

## Install both

From the repository root:

```bash
mkdir -p ~/.codex/skills
cp -R skills/chatgpt-file-review ~/.codex/skills/
cp -R skills/chatgpt-github-review ~/.codex/skills/
```

The installed layout becomes:

```text
~/.codex/skills/
├── chatgpt-file-review/
│   └── SKILL.md
└── chatgpt-github-review/
    └── SKILL.md
```

## Shared result transport

Both skills use the existing C2C handoff backend:

```bash
c2c handoff status -w <workspace> --json
```

For a headless Ubuntu Server, `google-drive` is recommended because it does not
require the user to click ChatGPT's Download button on the server.

Neither skill scrapes ChatGPT assistant output from the page.
