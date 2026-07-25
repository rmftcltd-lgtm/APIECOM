import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config/env.js";
import type { CaptureSession } from "../types/listing.js";

async function ensureDirs(): Promise<void> {
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.mkdir(config.uploadDir, { recursive: true });
}

function sessionPath(id: string): string {
  return path.join(config.dataDir, `${id}.json`);
}

export async function saveSession(session: CaptureSession): Promise<void> {
  await ensureDirs();
  session.updatedAt = new Date().toISOString();
  await fs.writeFile(sessionPath(session.id), JSON.stringify(session, null, 2), "utf8");
}

export async function loadSession(id: string): Promise<CaptureSession | null> {
  try {
    const raw = await fs.readFile(sessionPath(id), "utf8");
    return JSON.parse(raw) as CaptureSession;
  } catch {
    return null;
  }
}

export async function listSessions(): Promise<CaptureSession[]> {
  await ensureDirs();
  const files = await fs.readdir(config.dataDir);
  const sessions: CaptureSession[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(config.dataDir, file), "utf8");
      sessions.push(JSON.parse(raw) as CaptureSession);
    } catch {
      // skip corrupt files
    }
  }
  return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function mediaDirForSession(sessionId: string): string {
  return path.join(config.uploadDir, sessionId);
}

export async function ensureSessionMediaDir(sessionId: string): Promise<string> {
  const dir = mediaDirForSession(sessionId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
