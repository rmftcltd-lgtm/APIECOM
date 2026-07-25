import { Router } from "express";
import { z } from "zod";
import { upload, VALID_SLOTS, assertSlotMime } from "../middleware/upload.js";
import {
  analyzeSession,
  attachMedia,
  completeSession,
  createSession,
  getAllSessions,
  getSession,
  publicSession,
  updateDraft,
} from "../services/sessionService.js";
import type { PhotoSlot } from "../types/listing.js";
import { config } from "../config/env.js";

export const apiRouter = Router();

const createSessionSchema = z.object({
  currency: z.string().min(3).max(3).optional(),
  country: z.string().min(2).max(2).optional(),
  markupPercent: z.number().min(0).max(500).optional(),
  defaultQuantity: z.number().int().min(1).max(999).optional(),
  whoMadeDefault: z.enum(["i_did", "collective", "someone_else"]).optional(),
});

const draftPatchSchema = z
  .object({
    title: z.string().min(1).max(140).optional(),
    description: z.string().min(1).optional(),
    tags: z.array(z.string()).max(13).optional(),
    materials: z.array(z.string()).max(13).optional(),
    categoryGuess: z.string().optional(),
    taxonomyId: z.number().int().nullable().optional(),
    whoMade: z.enum(["i_did", "collective", "someone_else"]).optional(),
    whenMade: z.string().optional(),
    isSupply: z.boolean().optional(),
    quantity: z.number().int().min(1).optional(),
    sku: z.string().nullable().optional(),
    conditionNotes: z.string().optional(),
    brandOrMaker: z.string().nullable().optional(),
    style: z.array(z.string()).max(2).optional(),
    occasion: z.string().nullable().optional(),
    recipient: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1).optional(),
    assumptions: z.array(z.string()).optional(),
    photoGuidance: z.array(z.string()).optional(),
    pricing: z
      .object({
        currency: z.string().optional(),
        suggestedPrice: z.number().positive().optional(),
        priceLow: z.number().positive().optional(),
        priceHigh: z.number().positive().optional(),
        estimatedCostBasis: z.number().nullable().optional(),
        markupPercent: z.number().optional(),
        rationale: z.string().optional(),
      })
      .optional(),
    shipping: z
      .object({
        weightGrams: z.number().positive().optional(),
        lengthCm: z.number().positive().optional(),
        widthCm: z.number().positive().optional(),
        heightCm: z.number().positive().optional(),
        domesticShippingEstimate: z.number().optional(),
        internationalShippingEstimate: z.number().optional(),
        processingDaysMin: z.number().int().optional(),
        processingDaysMax: z.number().int().optional(),
        rationale: z.string().optional(),
      })
      .optional(),
  })
  .strict();

apiRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "apiecom-etsy-listing-api",
    openaiConfigured: Boolean(config.openaiApiKey && !config.openaiApiKey.startsWith("sk-...")),
    etsyConfigured: Boolean(
      config.etsyApiKey && config.etsyAccessToken && config.etsyShopId,
    ),
  });
});

apiRouter.post("/sessions", async (req, res, next) => {
  try {
    const body = createSessionSchema.parse(req.body ?? {});
    const session = await createSession(body);
    res.status(201).json(publicSession(session));
  } catch (err) {
    next(err);
  }
});

apiRouter.get("/sessions", async (_req, res, next) => {
  try {
    const sessions = await getAllSessions();
    res.json({ sessions: sessions.map(publicSession) });
  } catch (err) {
    next(err);
  }
});

apiRouter.get("/sessions/:sessionId", async (req, res, next) => {
  try {
    const session = await getSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(publicSession(session));
  } catch (err) {
    next(err);
  }
});

/**
 * Upload one or more media files.
 * Multipart fields:
 *  - files: photo/video binaries (field name "files")
 *  - slots: comma-separated or repeated form field matching file order
 *    e.g. slots=front,back,detail,bottom_mark,context,video
 * Or upload a single file with form field "slot".
 */
apiRouter.post(
  "/sessions/:sessionId/media",
  upload.array("files", 6),
  async (req, res, next) => {
    try {
      const session = await getSession(req.params.sessionId);
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files?.length) {
        res.status(400).json({ error: "No files uploaded. Use multipart field 'files'." });
        return;
      }

      const slotsRaw = req.body.slots ?? req.body.slot;
      const slots: string[] = Array.isArray(slotsRaw)
        ? slotsRaw
        : String(slotsRaw ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

      if (slots.length !== files.length) {
        res.status(400).json({
          error:
            "Provide a matching 'slots' list (comma-separated) with one slot per uploaded file.",
          expectedSlots: [...VALID_SLOTS],
        });
        return;
      }

      for (const slot of slots) {
        if (!VALID_SLOTS.has(slot)) {
          res.status(400).json({
            error: `Invalid slot "${slot}"`,
            expectedSlots: [...VALID_SLOTS],
          });
          return;
        }
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const slot = slots[i];
        assertSlotMime(slot, file.mimetype);
        if (slot === "video" && file.size > config.maxVideoBytes) {
          res.status(400).json({ error: "Video exceeds size limit" });
          return;
        }
        if (slot !== "video" && file.size > config.maxPhotoBytes) {
          res.status(400).json({ error: `Photo ${slot} exceeds size limit` });
          return;
        }
      }

      const updated = await attachMedia(
        req.params.sessionId,
        files.map((file, i) => ({
          slot: slots[i] as PhotoSlot | "video",
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          absolutePath: file.path,
        })),
      );

      res.status(200).json(publicSession(updated));
    } catch (err) {
      next(err);
    }
  },
);

apiRouter.post("/sessions/:sessionId/analyze", async (req, res, next) => {
  try {
    const session = await analyzeSession(req.params.sessionId);
    res.json(publicSession(session));
  } catch (err) {
    next(err);
  }
});

apiRouter.get("/sessions/:sessionId/draft", async (req, res, next) => {
  try {
    const session = await getSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    if (!session.draft) {
      res.status(404).json({ error: "Draft not ready — upload media and call analyze" });
      return;
    }
    res.json({ sessionId: session.id, status: session.status, draft: session.draft });
  } catch (err) {
    next(err);
  }
});

apiRouter.patch("/sessions/:sessionId/draft", async (req, res, next) => {
  try {
    const patch = draftPatchSchema.parse(req.body ?? {});
    const session = await updateDraft(req.params.sessionId, patch);
    res.json(publicSession(session));
  } catch (err) {
    next(err);
  }
});

apiRouter.post("/sessions/:sessionId/complete", async (req, res, next) => {
  try {
    const result = await completeSession(req.params.sessionId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
