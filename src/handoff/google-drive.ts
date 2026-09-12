import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getStateDir } from "../config/paths.js";
import {
  canonicalHandoffFilename,
  parseHandoffMarkdown,
  safeTaskToken,
  storeHandoffFile,
  type HandoffState,
  type ImportedHandoff,
} from "./files.js";

export interface WaitForGoogleDriveHandoffOptions {
  workspaceId: string;
  taskId: string;
  iteration?: number;
  allowedStates: readonly HandoffState[];
  remote: string;
  archiveRemote?: string;
  rcloneBin?: string;
  inboxDir?: string;
  timeoutMs?: number;
  pollMs?: number;
}

export interface GoogleDriveImportedHandoff extends ImportedHandoff {
  backend: "google-drive";
  remotePath: string;
  archivePath?: string;
  archiveWarning?: string;
}

interface RcloneResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  status: number | null;
}

function runRclone(bin: string, args: string[], timeout = 30_000): RcloneResult {
  const result = spawnSync(bin, args, {
    encoding: "utf8",
    timeout,
    windowsHide: true,
    env: process.env,
  });
  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`rclone not found: ${bin}. Install rclone and run 'rclone config'.`);
    }
    throw result.error;
  }
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
    status: result.status,
  };
}

export function chatgptDriveFolderFromRemote(remote: string): string {
  const value = remote.trim();
  const colon = value.indexOf(":");
  const drivePath = colon >= 0 ? value.slice(colon + 1) : value;
  return drivePath.replace(/^\/+|\/+$/g, "");
}

function remoteJoin(remote: string, filename: string): string {
  const base = remote.trim().replace(/\/+$/, "");
  if (!base) throw new Error("google-drive remote is empty");
  if (filename.includes("/") || filename.includes("\\")) throw new Error("handoff filename must not contain path separators");
  return `${base}/${filename}`;
}

function candidateIteration(filename: string): number {
  const match = filename.match(/-(\d+)\.md$/i);
  return match ? Number(match[1]) : -1;
}

function listCandidateNames(bin: string, remote: string, taskId: string): string[] {
  const result = runRclone(bin, ["lsf", remote, "--files-only", "--max-depth", "1"]);
  if (!result.ok) {
    throw new Error(`rclone lsf failed (${result.status ?? "?"}): ${result.stderr || result.stdout}`);
  }
  const prefix = `c2c-${safeTaskToken(taskId)}-`;
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((name) => name && name.startsWith(prefix) && name.toLowerCase().endsWith(".md"))
    .sort((a, b) => candidateIteration(b) - candidateIteration(a) || b.localeCompare(a));
}

function stageFilePath(workspaceId: string, filename: string): string {
  const dir = path.join(getStateDir(), "handoffs", workspaceId, "staging");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return path.join(dir, `${Date.now()}-${process.pid}-${filename}`);
}

function tryArchive(bin: string, sourceRemote: string, archiveRemote: string | undefined, filename: string): {
  archivePath?: string;
  archiveWarning?: string;
} {
  if (!archiveRemote) return {};
  const destination = remoteJoin(archiveRemote, filename);
  const result = runRclone(bin, ["moveto", sourceRemote, destination], 60_000);
  if (!result.ok) {
    return { archiveWarning: `rclone moveto failed: ${result.stderr || result.stdout}` };
  }
  return { archivePath: destination };
}

export function checkRcloneDrive(remote: string, rcloneBin = "rclone"): {
  ok: boolean;
  remote: string;
  detail: string;
} {
  const version = runRclone(rcloneBin, ["version"]);
  if (!version.ok) return { ok: false, remote, detail: version.stderr || "rclone version failed" };
  const listing = runRclone(rcloneBin, ["lsf", remote, "--files-only", "--max-depth", "1"], 30_000);
  if (!listing.ok) {
    return { ok: false, remote, detail: listing.stderr || listing.stdout || "Drive listing failed" };
  }
  return { ok: true, remote, detail: "rclone and remote are reachable" };
}

export async function waitForGoogleDriveHandoff(
  options: WaitForGoogleDriveHandoffOptions
): Promise<GoogleDriveImportedHandoff> {
  const bin = options.rcloneBin?.trim() || "rclone";
  const timeoutMs = options.timeoutMs ?? 30 * 60 * 1000;
  const pollMs = Math.max(1000, options.pollMs ?? 5000);
  if (timeoutMs < 0) throw new Error("handoff timeout must be non-negative");
  if (options.allowedStates.length === 0) throw new Error("at least one handoff state is required");

  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const candidates = listCandidateNames(bin, options.remote, options.taskId);
    for (const filename of candidates) {
      const remotePath = remoteJoin(options.remote, filename);
      const staged = stageFilePath(options.workspaceId, filename);
      const copy = runRclone(bin, ["copyto", remotePath, staged], 60_000);
      if (!copy.ok) {
        try { fs.rmSync(staged, { force: true }); } catch { /* best effort */ }
        continue;
      }

      try {
        const envelope = parseHandoffMarkdown(fs.readFileSync(staged, "utf8"));
        if (envelope.taskId !== options.taskId) {
          fs.rmSync(staged, { force: true });
          continue;
        }
        if (options.iteration !== undefined && envelope.iteration !== options.iteration) {
          fs.rmSync(staged, { force: true });
          continue;
        }
        if (!options.allowedStates.includes(envelope.state)) {
          fs.rmSync(staged, { force: true });
          continue;
        }

        const stored = storeHandoffFile({
          sourcePath: staged,
          workspaceId: options.workspaceId,
          inboxDir: options.inboxDir,
          envelope,
        });
        const archive = tryArchive(bin, remotePath, options.archiveRemote, filename);
        return {
          ...stored,
          backend: "google-drive",
          remotePath,
          ...archive,
        };
      } catch {
        try { fs.rmSync(staged, { force: true }); } catch { /* best effort */ }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  const iter = options.iteration === undefined ? "any iteration" : `iteration ${options.iteration}`;
  throw new Error(
    `timed out waiting for ${options.taskId} (${iter}; ${options.allowedStates.join("/")}) in ${options.remote}`
  );
}
