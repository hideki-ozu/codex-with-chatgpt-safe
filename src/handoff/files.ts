import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const HANDOFF_STATES = ["VERIFY", "PLAN", "REVIEW", "DONE", "BLOCKED"] as const;
export type HandoffState = (typeof HANDOFF_STATES)[number];

export interface HandoffEnvelope {
  protocol: "c2c";
  taskId: string;
  state: HandoffState;
  iteration: number;
  body: string;
}

export interface WaitForHandoffOptions {
  workspaceRoot: string;
  taskId: string;
  iteration?: number;
  allowedStates: readonly HandoffState[];
  sourceDir?: string;
  timeoutMs?: number;
  pollMs?: number;
}

export interface ImportedHandoff extends HandoffEnvelope {
  sourcePath: string;
  inboxPath: string;
}

export function defaultDownloadsDir(): string {
  const override = process.env.C2C_DOWNLOADS_DIR?.trim();
  return path.resolve(override || path.join(os.homedir(), "Downloads"));
}

function safeTaskToken(taskId: string): string {
  const safe = taskId.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
  if (!safe) throw new Error("handoff task id is empty");
  return safe;
}

export function canonicalHandoffFilename(taskId: string, state: HandoffState, iteration: number): string {
  return `c2c-${safeTaskToken(taskId)}-${state.toLowerCase()}-${iteration}.md`;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseHandoffMarkdown(content: string): HandoffEnvelope {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    throw new Error("handoff markdown must start with YAML frontmatter");
  }
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) throw new Error("handoff markdown frontmatter is not closed");

  const fields = new Map<string, string>();
  for (const line of normalized.slice(4, end).split("\n")) {
    const match = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    fields.set(match[1].toLowerCase(), unquote(match[2]));
  }

  if (fields.get("protocol")?.toLowerCase() !== "c2c") {
    throw new Error("handoff protocol must be c2c");
  }
  const taskId = fields.get("task_id")?.trim();
  if (!taskId) throw new Error("handoff task_id is required");

  const stateRaw = fields.get("state")?.trim().toUpperCase();
  if (!stateRaw || !HANDOFF_STATES.includes(stateRaw as HandoffState)) {
    throw new Error(`handoff state must be one of ${HANDOFF_STATES.join(", ")}`);
  }

  const iterationRaw = fields.get("iteration")?.trim();
  if (!iterationRaw || !/^\d+$/.test(iterationRaw)) {
    throw new Error("handoff iteration must be a non-negative integer");
  }
  const iteration = Number(iterationRaw);
  if (!Number.isSafeInteger(iteration)) throw new Error("handoff iteration is too large");

  return {
    protocol: "c2c",
    taskId,
    state: stateRaw as HandoffState,
    iteration,
    body: normalized.slice(end + 5).trim(),
  };
}

function moveAcrossDevices(sourcePath: string, destinationPath: string): void {
  try {
    fs.renameSync(sourcePath, destinationPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EXDEV") throw error;
    fs.copyFileSync(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
    fs.unlinkSync(sourcePath);
  }
}

function findCandidate(
  sourceDir: string,
  taskId: string,
  iteration: number | undefined,
  allowedStates: readonly HandoffState[],
  notOlderThanMs: number
): { filePath: string; envelope: HandoffEnvelope } | null {
  if (!fs.existsSync(sourceDir)) return null;
  const prefix = `c2c-${safeTaskToken(taskId)}-`;
  const candidates = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md") && entry.name.startsWith(prefix))
    .map((entry) => {
      const filePath = path.join(sourceDir, entry.name);
      return { filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
    })
    .filter((entry) => entry.mtimeMs >= notOlderThanMs)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const candidate of candidates) {
    try {
      const envelope = parseHandoffMarkdown(fs.readFileSync(candidate.filePath, "utf8"));
      if (envelope.taskId !== taskId) continue;
      if (iteration !== undefined && envelope.iteration !== iteration) continue;
      if (!allowedStates.includes(envelope.state)) continue;
      return { filePath: candidate.filePath, envelope };
    } catch {
      // Ignore incomplete, unrelated, or malformed Markdown files while waiting.
    }
  }
  return null;
}

export async function waitForHandoff(options: WaitForHandoffOptions): Promise<ImportedHandoff> {
  const sourceDir = path.resolve(options.sourceDir ?? defaultDownloadsDir());
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const timeoutMs = options.timeoutMs ?? 30 * 60 * 1000;
  const pollMs = Math.max(250, options.pollMs ?? 1000);
  if (timeoutMs < 0) throw new Error("handoff timeout must be non-negative");
  if (options.allowedStates.length === 0) throw new Error("at least one handoff state is required");

  const startedAt = Date.now();
  const notOlderThanMs = startedAt - 2000;

  while (Date.now() - startedAt <= timeoutMs) {
    const candidate = findCandidate(
      sourceDir,
      options.taskId,
      options.iteration,
      options.allowedStates,
      notOlderThanMs
    );
    if (candidate) {
      const inboxDir = path.join(workspaceRoot, ".c2c", "inbox");
      fs.mkdirSync(inboxDir, { recursive: true });
      const destinationPath = path.join(
        inboxDir,
        canonicalHandoffFilename(
          candidate.envelope.taskId,
          candidate.envelope.state,
          candidate.envelope.iteration
        )
      );
      if (fs.existsSync(destinationPath)) {
        throw new Error(`handoff already imported: ${destinationPath}`);
      }
      moveAcrossDevices(candidate.filePath, destinationPath);
      return {
        ...candidate.envelope,
        sourcePath: candidate.filePath,
        inboxPath: destinationPath,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  const iter = options.iteration === undefined ? "any iteration" : `iteration ${options.iteration}`;
  throw new Error(
    `timed out waiting for ${options.taskId} (${iter}; ${options.allowedStates.join("/")}) in ${sourceDir}`
  );
}
