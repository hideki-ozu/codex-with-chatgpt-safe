import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { waitForGoogleDriveHandoff, checkRcloneDrive } from "../src/handoff/google-drive.js";

const roots: string[] = [];

function tempDir(label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `c2c-${label}-`));
  roots.push(dir);
  return dir;
}

function makeFakeRclone(root: string): string {
  const file = path.join(root, "fake-rclone");
  fs.writeFileSync(
    file,
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const root = process.env.FAKE_RCLONE_ROOT;
const args = process.argv.slice(2);
function mapRemote(value) {
  const colon = value.indexOf(":");
  const rel = colon >= 0 ? value.slice(colon + 1) : value;
  return path.join(root, rel.replace(/^\\/+/, ""));
}
const cmd = args[0];
if (cmd === "version") {
  process.stdout.write("rclone v-test\\n");
  process.exit(0);
}
if (cmd === "lsf") {
  const dir = mapRemote(args[1]);
  if (!fs.existsSync(dir)) process.exit(0);
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isFile()) process.stdout.write(ent.name + "\\n");
  }
  process.exit(0);
}
if (cmd === "copyto") {
  const src = mapRemote(args[1]);
  const dst = args[2];
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  process.exit(0);
}
if (cmd === "moveto") {
  const src = mapRemote(args[1]);
  const dst = mapRemote(args[2]);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.renameSync(src, dst);
  process.exit(0);
}
process.stderr.write("unsupported fake rclone command: " + cmd + "\\n");
process.exit(2);
`
  );
  fs.chmodSync(file, 0o755);
  return file;
}

afterEach(() => {
  delete process.env.FAKE_RCLONE_ROOT;
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe.skipIf(process.platform === "win32")("Google Drive handoff via rclone", () => {
  it("checks an rclone remote", () => {
    const root = tempDir("drive-check");
    fs.mkdirSync(path.join(root, "C2C-Handoff", "inbox"), { recursive: true });
    process.env.FAKE_RCLONE_ROOT = root;
    const fake = makeFakeRclone(root);

    expect(checkRcloneDrive("gdrive:C2C-Handoff/inbox", fake)).toMatchObject({
      ok: true,
      remote: "gdrive:C2C-Handoff/inbox",
    });
  });

  it("downloads, validates, stores, and archives a Drive handoff", async () => {
    const root = tempDir("drive");
    const inboxRemote = path.join(root, "C2C-Handoff", "inbox");
    const archiveRemote = path.join(root, "C2C-Handoff", "processed");
    const localInbox = path.join(root, "local-inbox");
    fs.mkdirSync(inboxRemote, { recursive: true });
    fs.mkdirSync(archiveRemote, { recursive: true });

    const filename = "c2c-task-drive-plan-1.md";
    fs.writeFileSync(
      path.join(inboxRemote, filename),
      `---
protocol: c2c
task_id: task-drive
state: PLAN
iteration: 1
---

# Actions
1. Update the service.
`
    );

    process.env.FAKE_RCLONE_ROOT = root;
    const fake = makeFakeRclone(root);

    const result = await waitForGoogleDriveHandoff({
      workspaceId: "workspace-drive",
      taskId: "task-drive",
      iteration: 1,
      allowedStates: ["PLAN"],
      remote: "gdrive:C2C-Handoff/inbox",
      archiveRemote: "gdrive:C2C-Handoff/processed",
      rcloneBin: fake,
      inboxDir: localInbox,
      timeoutMs: 1000,
      pollMs: 10,
    });

    expect(result.backend).toBe("google-drive");
    expect(result.body).toContain("Update the service");
    expect(fs.existsSync(result.inboxPath)).toBe(true);
    expect(fs.existsSync(path.join(inboxRemote, filename))).toBe(false);
    expect(fs.existsSync(path.join(archiveRemote, filename))).toBe(true);
    expect(result.archivePath).toBe("gdrive:C2C-Handoff/processed/" + filename);
  });

  it("ignores a mismatched task file and times out", async () => {
    const root = tempDir("drive-mismatch");
    const inboxRemote = path.join(root, "C2C-Handoff", "inbox");
    fs.mkdirSync(inboxRemote, { recursive: true });
    fs.writeFileSync(
      path.join(inboxRemote, "c2c-task-drive-plan-1.md"),
      `---
protocol: c2c
task_id: different-task
state: PLAN
iteration: 1
---

Nope.
`
    );
    process.env.FAKE_RCLONE_ROOT = root;
    const fake = makeFakeRclone(root);

    await expect(
      waitForGoogleDriveHandoff({
        workspaceId: "workspace-drive",
        taskId: "task-drive",
        allowedStates: ["PLAN"],
        remote: "gdrive:C2C-Handoff/inbox",
        rcloneBin: fake,
        timeoutMs: 25,
        pollMs: 5,
      })
    ).rejects.toThrow("timed out waiting");
  });
});
