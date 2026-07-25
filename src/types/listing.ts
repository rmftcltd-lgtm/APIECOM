export type PhotoSlot =
  | "front"
  | "back"
  | "detail"
  | "bottom_mark"
  | "context";

export const REQUIRED_PHOTO_SLOTS: PhotoSlot[] = [
  "front",
  "back",
  "detail",
  "bottom_mark",
  "context",
];

export type SessionStatus =
  | "awaiting_media"
  | "ready_to_analyze"
  | "analyzing"
  | "draft_ready"
  | "completed"
  | "failed";

export interface MediaFile {
  slot: PhotoSlot | "video";
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  path: string;
  uploadedAt: string;
}

export interface PricingAssumptions {
  currency: string;
  suggestedPrice: number;
  priceLow: number;
  priceHigh: number;
  estimatedCostBasis: number | null;
  markupPercent: number;
  rationale: string;
}

export interface ShippingAssumptions {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  domesticShippingEstimate: number;
  internationalShippingEstimate: number;
  processingDaysMin: number;
  processingDaysMax: number;
  rationale: string;
}

export interface ListingDraft {
  title: string;
  description: string;
  tags: string[];
  materials: string[];
  categoryGuess: string;
  taxonomyId: number | null;
  whoMade: "i_did" | "collective" | "someone_else";
  whenMade: string;
  isSupply: boolean;
  quantity: number;
  sku: string | null;
  conditionNotes: string;
  brandOrMaker: string | null;
  style: string[];
  occasion: string | null;
  recipient: string | null;
  pricing: PricingAssumptions;
  shipping: ShippingAssumptions;
  confidence: number;
  assumptions: string[];
  photoGuidance: string[];
}

export interface CaptureSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  shopHints?: {
    currency?: string;
    country?: string;
    markupPercent?: number;
    defaultQuantity?: number;
    whoMadeDefault?: "i_did" | "collective" | "someone_else";
  };
  media: MediaFile[];
  draft: ListingDraft | null;
  etsyListingId: number | null;
  error: string | null;
}

export interface AnalyzeResult {
  sessionId: string;
  status: SessionStatus;
  draft: ListingDraft;
}

export interface CompleteResult {
  sessionId: string;
  status: SessionStatus;
  draft: ListingDraft;
  etsy: {
    listingId: number | null;
    state: "draft" | "local_only";
    url: string | null;
    message: string;
  };
}
