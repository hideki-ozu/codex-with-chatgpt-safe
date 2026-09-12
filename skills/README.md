# Optional ChatGPT Web skills

These skills are optional and independent from the main `skill/SKILL.md` C2C
coding workflow.

They target the Ubuntu headless-browser setup where ChatGPT Web is already
reachable with an authenticated Chromium session.

None of these workflows gives ChatGPT Web direct access to the Ubuntu repository.
They use only explicitly selected local attachments and/or GitHub-hosted content.

## 1. `chatgpt-file-review`

Use when ChatGPT should review one or more explicitly selected files that exist
on the Ubuntu host.

```text
Ubuntu file(s)
    ↓ browser attachment
ChatGPT Web
    ↓ C2C REVIEW handoff
Google Drive (recommended) or manual Download
    ↓
Ubuntu / Codex
```

Install:

```bash
mkdir -p ~/.codex/skills
cp -R skills/chatgpt-file-review ~/.codex/skills/
```

Typical request:

```text
ChatGPT Webを使って /home/me/project/docs/design.md をレビューして。
設計上の矛盾と抜けを重点的に見て。
```

## 2. `chatgpt-github-review`

Use when ChatGPT should inspect and review content hosted on GitHub while the
Ubuntu local checkout remains private from ChatGPT Web.

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

Typical requests:

```text
ChatGPT Webで https://github.com/OWNER/REPO を読んで、アーキテクチャをレビューして。
```

```text
ChatGPT Webで OWNER/REPO の PR #123 をレビューして。
重大な不具合の可能性を優先して。
```

## 3. `chatgpt-world-image`

Use when ChatGPT should understand a fictional/project world from a specified
GitHub repository and then generate an image from an explicitly attached Ubuntu
prompt file.

```text
GitHub world/canon repository
          ↓
      ChatGPT Web
          ↑
Ubuntu prompt file ── browser attachment
          ↓
  ChatGPT image generation
          ↓
Google Drive when supported
or manual image Download
```

The GitHub repository is treated as canon/world context. The attached file is the
concrete image-generation instruction for the current run. The Ubuntu repository
itself is never exposed.

Install:

```bash
mkdir -p ~/.codex/skills
cp -R skills/chatgpt-world-image ~/.codex/skills/
```

Typical request:

```text
ChatGPT Webで https://github.com/OWNER/NOVEL-WORLD の世界設定を読んで、
/home/me/prompts/chapter12-image.md をプロンプトとして挿絵を生成して。
```

A pinned branch/commit may be specified when reproducible canon is important:

```text
OWNER/NOVEL-WORLD の commit abc123 の世界設定を基準にして、
/home/me/prompts/cover.md を使って書籍カバー画像を生成して。
```

Optional reference images/documents may also be attached when explicitly selected
by the user. The prompt file remains authoritative for the requested scene, while
repository canon constrains characters, locations, era, technology/magic,
clothing, architecture, symbols, terminology, and other setting details.

The generated image should be saved through an official Google Drive action only
when ChatGPT can actually do so for the image. Otherwise the image is left visible
for an explicit manual Download. The skill never automates a ChatGPT Download
button click.

## Install all three

From the repository root:

```bash
mkdir -p ~/.codex/skills
cp -R skills/chatgpt-file-review ~/.codex/skills/
cp -R skills/chatgpt-github-review ~/.codex/skills/
cp -R skills/chatgpt-world-image ~/.codex/skills/
```

Installed layout:

```text
~/.codex/skills/
├── chatgpt-file-review/
│   └── SKILL.md
├── chatgpt-github-review/
│   └── SKILL.md
└── chatgpt-world-image/
    └── SKILL.md
```

Replace `<ACTUAL_CHECKOUT_PATH>` inside each installed `SKILL.md` with the actual
path to this repository checkout.

## Shared handoff behavior

Review skills use the existing C2C Markdown handoff backend:

```bash
c2c handoff status -w <workspace> --json
```

The image skill may additionally create a metadata sidecar through the same
handoff backend. The image artifact itself is not recovered by scraping ChatGPT.

For a headless Ubuntu Server, `google-drive` is recommended when the relevant
ChatGPT action can save the output. Otherwise use explicit manual Download.

None of these skills scrapes ChatGPT assistant output from the page.
