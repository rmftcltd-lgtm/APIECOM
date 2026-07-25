import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { config } from "../config/env.js";
import type { CaptureSession, ListingDraft, MediaFile } from "../types/listing.js";
import { applyCommercialAssumptions } from "./pricing.js";
import { guessTaxonomy } from "./taxonomy.js";

const ANALYSIS_SCHEMA_HINT = `{
  "title": "string, SEO-friendly, max 140 chars",
  "description": "string, warm marketplace copy with materials, measurements, condition, care",
  "tags": ["up to 13 short search tags"],
  "materials": ["detected materials"],
  "categoryGuess": "human readable category",
  "whoMade": "i_did | collective | someone_else",
  "whenMade": "etsy when_made value e.g. 2020_2024 | 2010_2019 | before_2000 | made_to_order",
  "isSupply": false,
  "quantity": 1,
  "sku": "optional string or null",
  "conditionNotes": "condition summary",
  "brandOrMaker": "maker mark/label text or null",
  "style": ["up to 2 styles"],
  "occasion": "string or null",
  "recipient": "women | men | unisex | girls | boys | baby | null",
  "estimatedRetailHint": number or null,
  "weightGrams": number,
  "lengthCm": number,
  "widthCm": number,
  "heightCm": number,
  "confidence": 0 to 1,
  "assumptions": ["what you inferred"],
  "photoGuidance": ["any missing photo tips for the seller"]
}`;

function mimeToDataUrl(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}

async function fileToDataUrl(file: MediaFile): Promise<string> {
  const buf = await fs.readFile(file.path);
  return mimeToDataUrl(file.mimeType, buf.toString("base64"));
}

function buildFallbackDraft(session: CaptureSession): ListingDraft {
  const hasMark = session.media.some((m) => m.slot === "bottom_mark");
  const categoryGuess = "Vintage clothing / apparel";
  const title = "Vintage item — review AI draft title";
  const taxonomy = guessTaxonomy(categoryGuess, title);

  return applyCommercialAssumptions(
    {
      title,
      description:
        "AI could not reach a vision model, so this is a starter draft. Replace with item-specific details from your photos: materials, measurements, condition, maker's mark, and care instructions.",
      tags: [
        "vintage",
        "unique",
        "handmade",
        "gift",
        "retro",
        "one of a kind",
        "fashion",
        "collectible",
        "shop small",
        "preloved",
        "style",
        "wardrobe",
        "statement",
      ],
      materials: ["unknown"],
      categoryGuess,
      taxonomyId: taxonomy.taxonomyId,
      whoMade: session.shopHints?.whoMadeDefault ?? "someone_else",
      whenMade: "2010_2019",
      isSupply: false,
      quantity: session.shopHints?.defaultQuantity ?? 1,
      sku: null,
      conditionNotes: hasMark
        ? "Inspect bottom/label photo for maker mark before publishing."
        : "Condition not assessed — add notes after reviewing photos.",
      brandOrMaker: null,
      style: ["vintage"],
      occasion: null,
      recipient: null,
      confidence: 0.25,
      assumptions: [
        "Fallback draft used because OPENAI_API_KEY is missing or analysis failed.",
        "Seller should edit all fields before completing.",
      ],
      photoGuidance: [
        "Ensure front, back, detail, bottom/label, and context photos are clear.",
        "Keep the 10s video well-lit and slowly orbit the item.",
      ],
      estimatedRetailHint: null,
      shipping: {
        weightGrams: 300,
        lengthCm: 35,
        widthCm: 28,
        heightCm: 6,
        domesticShippingEstimate: 0,
        internationalShippingEstimate: 0,
        processingDaysMin: 1,
        processingDaysMax: 3,
        rationale: "",
      },
    },
    {
      currency: session.shopHints?.currency,
      markupPercent: session.shopHints?.markupPercent,
    },
  );
}

function normalizeDraft(
  raw: Record<string, unknown>,
  session: CaptureSession,
): ListingDraft {
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map(String).slice(0, 13)
    : [];
  const materials = Array.isArray(raw.materials)
    ? raw.materials.map(String).slice(0, 13)
    : ["unknown"];
  const style = Array.isArray(raw.style) ? raw.style.map(String).slice(0, 2) : [];
  const assumptions = Array.isArray(raw.assumptions)
    ? raw.assumptions.map(String)
    : [];
  const photoGuidance = Array.isArray(raw.photoGuidance)
    ? raw.photoGuidance.map(String)
    : [];

  const title = String(raw.title ?? "Untitled listing").slice(0, 140);
  const categoryGuess = String(raw.categoryGuess ?? "Other");
  const taxonomy = guessTaxonomy(categoryGuess, title);

  const whoMadeRaw = String(raw.whoMade ?? session.shopHints?.whoMadeDefault ?? "someone_else");
  const whoMade =
    whoMadeRaw === "i_did" || whoMadeRaw === "collective" || whoMadeRaw === "someone_else"
      ? whoMadeRaw
      : "someone_else";

  return applyCommercialAssumptions(
    {
      title,
      description: String(raw.description ?? ""),
      tags,
      materials,
      categoryGuess,
      taxonomyId: taxonomy.taxonomyId,
      whoMade,
      whenMade: String(raw.whenMade ?? "2020_2024"),
      isSupply: Boolean(raw.isSupply),
      quantity: Number(raw.quantity ?? session.shopHints?.defaultQuantity ?? 1) || 1,
      sku: raw.sku == null ? null : String(raw.sku),
      conditionNotes: String(raw.conditionNotes ?? ""),
      brandOrMaker: raw.brandOrMaker == null ? null : String(raw.brandOrMaker),
      style,
      occasion: raw.occasion == null ? null : String(raw.occasion),
      recipient: raw.recipient == null ? null : String(raw.recipient),
      confidence: Math.min(1, Math.max(0, Number(raw.confidence ?? 0.7))),
      assumptions,
      photoGuidance,
      estimatedRetailHint:
        raw.estimatedRetailHint == null ? null : Number(raw.estimatedRetailHint),
      shipping: {
        weightGrams: Number(raw.weightGrams ?? 250),
        lengthCm: Number(raw.lengthCm ?? 30),
        widthCm: Number(raw.widthCm ?? 25),
        heightCm: Number(raw.heightCm ?? 5),
        domesticShippingEstimate: 0,
        internationalShippingEstimate: 0,
        processingDaysMin: 1,
        processingDaysMax: 3,
        rationale: "",
      },
    },
    {
      currency: session.shopHints?.currency,
      markupPercent: session.shopHints?.markupPercent,
    },
  );
}

function extractJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Model response did not contain JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
}

export async function analyzeSessionMedia(session: CaptureSession): Promise<ListingDraft> {
  if (!config.openaiApiKey || config.openaiApiKey.startsWith("sk-...")) {
    return buildFallbackDraft(session);
  }

  const photos = session.media.filter((m) => m.slot !== "video");
  const video = session.media.find((m) => m.slot === "video");

  const imageContents: OpenAI.Chat.ChatCompletionContentPart[] = [];
  for (const photo of photos) {
    const dataUrl = await fileToDataUrl(photo);
    imageContents.push({
      type: "text",
      text: `Photo slot: ${photo.slot}`,
    });
    imageContents.push({
      type: "image_url",
      image_url: { url: dataUrl, detail: "high" },
    });
  }

  if (video) {
    imageContents.push({
      type: "text",
      text: `A ${path.extname(video.filename)} video was captured (${Math.round(video.sizeBytes / 1024)} KB). Use surrounding still photos as primary evidence; treat the video as a walkaround confirming shape, scale, and defects.`,
    });
  }

  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const completion = await client.chat.completions.create({
    model: config.openaiModel,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `You are an expert Etsy merchandiser for high-volume shop owners. From product photos (front, back, detail, bottom/maker-mark, context) and notes about a short walkaround video, produce a complete listing draft. Read any visible labels, tags, size marks, and maker stamps. Prefer accurate vintage/handmade language. Return ONLY valid JSON matching this schema: ${ANALYSIS_SCHEMA_HINT}`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Create an Etsy listing draft for this item. Infer shipping dimensions/weight and a realistic retail price hint in the shop currency if possible.",
          },
          ...imageContents,
        ],
      },
    ],
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    return buildFallbackDraft(session);
  }

  try {
    const parsed = extractJsonObject(text);
    return normalizeDraft(parsed, session);
  } catch {
    return buildFallbackDraft(session);
  }
}
