import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  canonicalHandoffFilename,
  parseHandoffMarkdown,
  waitForHandoff,
} from "../src/handoff/files.js";

const tempRoots: string[] = [];

function tempDir(label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `c2c-${label}-`));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempRoots.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("Markdown handoff", () => {
  it("parses a C2C handoff envelope", () => {
    const parsed = parseHandoffMarkdown(`---
protocol: c2c
task_id: task-1
state: PLAN
iteration: 2
---

# Actions
1. Change the parser.
`);
    expect(parsed).toMatchObject({
      protocol: "c2c",
      taskId: "task-1",
      state: "PLAN",
      iteration: 2,
    });
    expect(parsed.body).toContain("Change the parser");
  });

  it("moves a downloaded handoff into the workspace inbox", async () => {
    const downloads = tempDir("downloads");
    const workspace = tempDir("workspace");
    const inbox = path.join(workspace, "inbox");
    const file = canonicalHandoffFilename("task-2", "DONE", 3);
    fs.writeFileSync(
      path.join(downloads, file),
      `---
protocol: c2c
task_id: task-2
state: DONE
iteration: 3
---

# Summary
Finished.
`
    );

    const result = await waitForHandoff({
      workspaceId: "workspace-test",
      sourceDir: downloads,
      inboxDir: inbox,
      taskId: "task-2",
      iteration: 3,
      allowedStates: ["DONE"],
      timeoutMs: 100,
      pollMs: 10,
    });

    expect(result.state).toBe("DONE");
    expect(result.body).toContain("Finished");
    expect(fs.existsSync(result.inboxPath)).toBe(true);
    expect(fs.existsSync(path.join(downloads, file))).toBe(false);
  });

  it("ignores malformed or mismatched Markdown", async () => {
    const downloads = tempDir("bad-downloads");
    const workspace = tempDir("bad-workspace");
    const inbox = path.join(workspace, "inbox");
    fs.writeFileSync(path.join(downloads, "c2c-task-3-plan-1.md"), "# not a handoff\n");

    await expect(
      waitForHandoff({
        workspaceId: "workspace-bad",
        sourceDir: downloads,
        inboxDir: inbox,
        taskId: "task-3",
        allowedStates: ["PLAN"],
        timeoutMs: 30,
        pollMs: 10,
      })
    ).rejects.toThrow("timed out waiting");
  });
});
