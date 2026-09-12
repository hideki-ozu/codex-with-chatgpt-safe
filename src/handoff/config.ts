import fs from "node:fs";
import path from "node:path";
import { getStateDir, readJsonIfExists, writeSecureJson } from "../config/paths.js";

export type HandoffBackend = "local" | "google-drive";

export interface LocalHandoffConfig {
  downloadsDir?: string;
  inboxDir?: string;
}

export interface GoogleDriveHandoffConfig {
  remote: string;
  archiveRemote?: string;
  rcloneBin?: string;
  inboxDir?: string;
}

export interface HandoffConfig {
  backend: HandoffBackend;
  local?: LocalHandoffConfig;
  googleDrive?: GoogleDriveHandoffConfig;
}

export function handoffConfigFile(workspaceId: string): string {
  return path.join(getStateDir(), "handoffs", workspaceId, "config.json");
}

export function defaultHandoffConfig(): HandoffConfig {
  return { backend: "local" };
}

export function readHandoffConfig(workspaceId: string): HandoffConfig {
  const saved = readJsonIfExists<HandoffConfig>(handoffConfigFile(workspaceId));
  if (!saved) return defaultHandoffConfig();
  if (saved.backend !== "local" && saved.backend !== "google-drive") {
    throw new Error("handoff config backend must be local or google-drive");
  }
  if (saved.backend === "google-drive" && !saved.googleDrive?.remote?.trim()) {
    throw new Error("google-drive handoff config requires googleDrive.remote");
  }
  return saved;
}

export function writeHandoffConfig(workspaceId: string, config: HandoffConfig): HandoffConfig {
  if (config.backend === "google-drive" && !config.googleDrive?.remote?.trim()) {
    throw new Error("google-drive handoff config requires --remote");
  }
  fs.mkdirSync(path.dirname(handoffConfigFile(workspaceId)), { recursive: true, mode: 0o700 });
  writeSecureJson(handoffConfigFile(workspaceId), config);
  return config;
}
