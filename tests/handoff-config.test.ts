import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultHandoffConfig,
  readHandoffConfig,
  writeHandoffConfig,
} from "../src/handoff/config.js";

const roots: string[] = [];

function stateDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "c2c-handoff-config-"));
  roots.push(dir);
  process.env.C2C_STATE_DIR = dir;
  return dir;
}

afterEach(() => {
  delete process.env.C2C_STATE_DIR;
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("handoff config", () => {
  it("defaults to local", () => {
    stateDir();
    expect(defaultHandoffConfig()).toEqual({ backend: "local" });
    expect(readHandoffConfig("ws")).toEqual({ backend: "local" });
  });

  it("persists google-drive configuration per workspace", () => {
    stateDir();
    writeHandoffConfig("ws", {
      backend: "google-drive",
      googleDrive: {
        remote: "gdrive:C2C-Handoff/inbox",
        archiveRemote: "gdrive:C2C-Handoff/processed",
        rcloneBin: "rclone",
      },
    });
    expect(readHandoffConfig("ws")).toEqual({
      backend: "google-drive",
      googleDrive: {
        remote: "gdrive:C2C-Handoff/inbox",
        archiveRemote: "gdrive:C2C-Handoff/processed",
        rcloneBin: "rclone",
      },
    });
  });

  it("rejects google-drive without a remote", () => {
    stateDir();
    expect(() =>
      writeHandoffConfig("ws", {
        backend: "google-drive",
        googleDrive: { remote: "" },
      })
    ).toThrow("requires --remote");
  });
});
