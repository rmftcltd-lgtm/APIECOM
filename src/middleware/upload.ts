import multer from "multer";
import path from "node:path";
import { config } from "../config/env.js";
import { ensureSessionMediaDir } from "../services/sessionStore.js";
import type { PhotoSlot } from "../types/listing.js";
import { REQUIRED_PHOTO_SLOTS } from "../types/listing.js";

const ALLOWED_IMAGE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const ALLOWED_VIDEO = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export const VALID_SLOTS = new Set<string>([...REQUIRED_PHOTO_SLOTS, "video"]);

function extensionFor(mime: string, originalName: string): string {
  const fromName = path.extname(originalName);
  if (fromName) return fromName.toLowerCase();
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "video/webm") return ".webm";
  if (mime === "video/quicktime") return ".mov";
  if (mime.startsWith("video/")) return ".mp4";
  return ".jpg";
}

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try {
      const sessionId = req.params.sessionId;
      const dir = await ensureSessionMediaDir(sessionId);
      cb(null, dir);
    } catch (err) {
      cb(err as Error, config.uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const slot = String(req.body.slot ?? file.fieldname ?? "front");
    const ext = extensionFor(file.mimetype, file.originalname);
    cb(null, `${slot}${ext}`);
  },
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  if (ALLOWED_IMAGE.has(file.mimetype) || ALLOWED_VIDEO.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error(`Unsupported file type: ${file.mimetype}`));
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxVideoBytes,
    files: 6,
  },
});

export function assertSlotMime(slot: string, mimeType: string): void {
  if (slot === "video") {
    if (!ALLOWED_VIDEO.has(mimeType)) {
      throw new Error(`Slot "video" requires a video file, got ${mimeType}`);
    }
    return;
  }
  if (!ALLOWED_IMAGE.has(mimeType)) {
    throw new Error(`Slot "${slot}" requires an image file, got ${mimeType}`);
  }
}

export function isPhotoSlot(slot: string): slot is PhotoSlot {
  return (REQUIRED_PHOTO_SLOTS as string[]).includes(slot);
}
