import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  CaptureSession,
  CompleteResult,
  ListingDraft,
  MediaFile,
  PhotoSlot,
  SessionStatus,
} from "../types/listing.js";
import { REQUIRED_PHOTO_SLOTS } from "../types/listing.js";
import {
  ensureSessionMediaDir,
  listSessions,
  loadSession,
  saveSession,
} from "./sessionStore.js";
import { analyzeSessionMedia } from "./analyzer.js";
import { createEtsyDraftListing } from "./etsyClient.js";

export interface CreateSessionInput {
  currency?: string;
  country?: string;
  markupPercent?: number;
  defaultQuantity?: number;
  whoMadeDefault?: "i_did" | "collective" | "someone_else";
}

function deriveStatus(session: CaptureSession): SessionStatus {
  if (session.status === "analyzing" || session.status === "completed" || session.status === "failed") {
    return session.status;
  }
  if (session.draft) return "draft_ready";

  const slots = new Set(session.media.map((m) => m.slot));
  const hasAllPhotos = REQUIRED_PHOTO_SLOTS.every((s) => slots.has(s));
  const hasVideo = slots.has("video");
  return hasAllPhotos && hasVideo ? "ready_to_analyze" : "awaiting_media";
}

export async function createSession(input: CreateSessionInput = {}): Promise<CaptureSession> {
  const id = randomUUID();
  await ensureSessionMediaDir(id);
  const now = new Date().toISOString();
  const session: CaptureSession = {
    id,
    createdAt: now,
    updatedAt: now,
    status: "awaiting_media",
    shopHints: {
      currency: input.currency,
      country: input.country,
      markupPercent: input.markupPercent,
      defaultQuantity: input.defaultQuantity,
      whoMadeDefault: input.whoMadeDefault,
    },
    media: [],
    draft: null,
    etsyListingId: null,
    error: null,
  };
  await saveSession(session);
  return session;
}

export async function getSession(id: string): Promise<CaptureSession | null> {
  return loadSession(id);
}

export async function getAllSessions(): Promise<CaptureSession[]> {
  return listSessions();
}

export async function attachMedia(
  sessionId: string,
  files: Array<{
    slot: PhotoSlot | "video";
    filename: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    absolutePath: string;
  }>,
): Promise<CaptureSession> {
  const session = await loadSession(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.status === "completed") {
    throw new Error("Session already completed");
  }

  for (const file of files) {
    const media: MediaFile = {
      slot: file.slot,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      path: file.absolutePath,
      uploadedAt: new Date().toISOString(),
    };
    session.media = session.media.filter((m) => m.slot !== file.slot);
    session.media.push(media);
  }

  session.draft = null;
  session.error = null;
  session.status = deriveStatus(session);
  await saveSession(session);
  return session;
}

export function missingMedia(session: CaptureSession): Array<PhotoSlot | "video"> {
  const present = new Set(session.media.map((m) => m.slot));
  const missing: Array<PhotoSlot | "video"> = [];
  for (const slot of REQUIRED_PHOTO_SLOTS) {
    if (!present.has(slot)) missing.push(slot);
  }
  if (!present.has("video")) missing.push("video");
  return missing;
}

export async function analyzeSession(sessionId: string): Promise<CaptureSession> {
  const session = await loadSession(sessionId);
  if (!session) throw new Error("Session not found");

  const missing = missingMedia(session);
  if (missing.length) {
    throw new Error(`Missing required media: ${missing.join(", ")}`);
  }

  session.status = "analyzing";
  session.error = null;
  await saveSession(session);

  try {
    const draft = await analyzeSessionMedia(session);
    session.draft = draft;
    session.status = "draft_ready";
    await saveSession(session);
    return session;
  } catch (err) {
    session.status = "failed";
    session.error = err instanceof Error ? err.message : "Analysis failed";
    await saveSession(session);
    throw err;
  }
}

export type DraftPatch = {
  [K in keyof ListingDraft]?: K extends "pricing" | "shipping"
    ? Partial<ListingDraft[K]>
    : ListingDraft[K];
};

export async function updateDraft(
  sessionId: string,
  patch: DraftPatch,
): Promise<CaptureSession> {
  const session = await loadSession(sessionId);
  if (!session) throw new Error("Session not found");
  if (!session.draft) throw new Error("No draft to update — run analyze first");
  if (session.status === "completed") throw new Error("Session already completed");

  session.draft = {
    ...session.draft,
    ...patch,
    pricing: patch.pricing
      ? { ...session.draft.pricing, ...patch.pricing }
      : session.draft.pricing,
    shipping: patch.shipping
      ? { ...session.draft.shipping, ...patch.shipping }
      : session.draft.shipping,
    tags: patch.tags ?? session.draft.tags,
    materials: patch.materials ?? session.draft.materials,
    style: patch.style ?? session.draft.style,
    assumptions: patch.assumptions ?? session.draft.assumptions,
    photoGuidance: patch.photoGuidance ?? session.draft.photoGuidance,
  };
  session.status = "draft_ready";
  await saveSession(session);
  return session;
}

export async function completeSession(sessionId: string): Promise<CompleteResult> {
  const session = await loadSession(sessionId);
  if (!session) throw new Error("Session not found");
  if (!session.draft) throw new Error("No draft available — run analyze first");

  const etsy = await createEtsyDraftListing(session, session.draft);
  session.etsyListingId = etsy.listingId;
  session.status = "completed";
  await saveSession(session);

  return {
    sessionId: session.id,
    status: session.status,
    draft: session.draft,
    etsy,
  };
}

export function publicSession(session: CaptureSession) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    status: session.status,
    shopHints: session.shopHints,
    media: session.media.map((m) => ({
      slot: m.slot,
      filename: m.filename,
      originalName: m.originalName,
      mimeType: m.mimeType,
      sizeBytes: m.sizeBytes,
      uploadedAt: m.uploadedAt,
      relativePath: path.posix.join(session.id, m.filename),
    })),
    missingMedia: missingMedia(session),
    draft: session.draft,
    etsyListingId: session.etsyListingId,
    error: session.error,
    captureGuide: {
      photos: [
        { slot: "front", prompt: "Front of the item, well lit, fill the frame" },
        { slot: "back", prompt: "Back of the item" },
        { slot: "detail", prompt: "Close-up of texture, stitching, or notable detail" },
        {
          slot: "bottom_mark",
          prompt: "Bottom, label, maker's mark, size tag, or care label",
        },
        { slot: "context", prompt: "Item in context / scale (on hanger, table, or worn flat)" },
      ],
      video: {
        slot: "video",
        maxSeconds: 10,
        prompt: "Slow 10-second walkaround showing shape, scale, and any flaws",
      },
    },
  };
}
