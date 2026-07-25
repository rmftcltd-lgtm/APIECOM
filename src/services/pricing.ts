import type {
  ListingDraft,
  PricingAssumptions,
  ShippingAssumptions,
} from "../types/listing.js";
import { config } from "../config/env.js";

export interface PricingInput {
  categoryGuess: string;
  materials: string[];
  brandOrMaker: string | null;
  conditionNotes: string;
  currency?: string;
  markupPercent?: number;
  estimatedRetailHint?: number | null;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

const CATEGORY_BASE_PRICES: Record<string, number> = {
  clothing: 38,
  jewelry: 45,
  home: 55,
  art: 65,
  vintage: 48,
  accessories: 32,
  craft: 28,
  other: 35,
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function detectCategoryKey(categoryGuess: string): string {
  const c = categoryGuess.toLowerCase();
  if (/(dress|shirt|jacket|coat|trouser|pant|skirt|clothing|apparel|wear)/.test(c)) {
    return "clothing";
  }
  if (/(jewel|ring|necklace|earring|bracelet)/.test(c)) return "jewelry";
  if (/(home|decor|vase|candle|furniture|kitchen)/.test(c)) return "home";
  if (/(art|print|painting|poster|illustration)/.test(c)) return "art";
  if (/(vintage|antique|retro)/.test(c)) return "vintage";
  if (/(bag|hat|scarf|belt|accessory)/.test(c)) return "accessories";
  if (/(craft|supply|yarn|fabric|bead)/.test(c)) return "craft";
  return "other";
}

export function estimatePricing(input: PricingInput): PricingAssumptions {
  const currency = input.currency ?? config.defaultCurrency;
  const markupPercent = input.markupPercent ?? config.defaultMarkupPercent;
  const categoryKey = detectCategoryKey(input.categoryGuess);
  let base = CATEGORY_BASE_PRICES[categoryKey] ?? CATEGORY_BASE_PRICES.other;

  if (input.brandOrMaker) {
    base *= 1.25;
  }
  if (/excellent|mint|new|unused/i.test(input.conditionNotes)) {
    base *= 1.15;
  } else if (/fair|worn|damage|stain|flaw/i.test(input.conditionNotes)) {
    base *= 0.75;
  }

  if (input.materials.some((m) => /silk|cashmere|gold|sterling|leather/i.test(m))) {
    base *= 1.2;
  }

  const estimatedCostBasis =
    input.estimatedRetailHint != null
      ? roundMoney(input.estimatedRetailHint / (1 + markupPercent / 100))
      : null;

  const suggested =
    input.estimatedRetailHint != null
      ? input.estimatedRetailHint
      : base * (1 + markupPercent / 100);

  const suggestedPrice = roundMoney(Math.max(9.99, suggested));
  const priceLow = roundMoney(suggestedPrice * 0.85);
  const priceHigh = roundMoney(suggestedPrice * 1.2);

  return {
    currency,
    suggestedPrice,
    priceLow,
    priceHigh,
    estimatedCostBasis,
    markupPercent,
    rationale: `Category baseline (${categoryKey}) adjusted for brand/condition/materials with ~${markupPercent}% markup. Review before publishing.`,
  };
}

export function estimateShipping(input: PricingInput): ShippingAssumptions {
  const weightKg = Math.max(input.weightGrams, 50) / 1000;
  const domestic = roundMoney(
    config.defaultBaseShipping + weightKg * config.defaultWeightShippingPerKg,
  );
  const volumetric =
    (input.lengthCm * input.widthCm * input.heightCm) / 5000;
  const billableKg = Math.max(weightKg, volumetric);
  const international = roundMoney(
    config.defaultBaseShipping * 2.2 + billableKg * config.defaultWeightShippingPerKg * 3.5,
  );

  return {
    weightGrams: Math.round(input.weightGrams),
    lengthCm: roundMoney(input.lengthCm),
    widthCm: roundMoney(input.widthCm),
    heightCm: roundMoney(input.heightCm),
    domesticShippingEstimate: domestic,
    internationalShippingEstimate: international,
    processingDaysMin: 1,
    processingDaysMax: 3,
    rationale:
      "Domestic shipping estimated from base + weight; international uses volumetric weight. Map to an Etsy shipping profile before go-live.",
  };
}

export function applyCommercialAssumptions(
  draft: Omit<ListingDraft, "pricing" | "shipping"> & {
    pricing?: PricingAssumptions;
    shipping?: ShippingAssumptions;
    estimatedRetailHint?: number | null;
  },
  hints?: {
    currency?: string;
    markupPercent?: number;
  },
): ListingDraft {
  const pricingInput: PricingInput = {
    categoryGuess: draft.categoryGuess,
    materials: draft.materials,
    brandOrMaker: draft.brandOrMaker,
    conditionNotes: draft.conditionNotes,
    currency: hints?.currency,
    markupPercent: hints?.markupPercent,
    estimatedRetailHint: draft.estimatedRetailHint ?? null,
    weightGrams: draft.shipping?.weightGrams ?? 250,
    lengthCm: draft.shipping?.lengthCm ?? 30,
    widthCm: draft.shipping?.widthCm ?? 25,
    heightCm: draft.shipping?.heightCm ?? 5,
  };

  const pricing = estimatePricing(pricingInput);
  const shipping = estimateShipping(pricingInput);

  const { estimatedRetailHint: _ignored, ...rest } = draft;
  return {
    ...rest,
    pricing,
    shipping,
    assumptions: [
      ...draft.assumptions,
      pricing.rationale,
      shipping.rationale,
    ],
  };
}
