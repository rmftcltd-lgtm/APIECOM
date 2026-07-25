import { describe, expect, it } from "vitest";
import { estimatePricing, estimateShipping, applyCommercialAssumptions } from "../src/services/pricing.js";
import { guessTaxonomy } from "../src/services/taxonomy.js";

describe("pricing heuristics", () => {
  it("raises price for branded excellent condition silk items", () => {
    const plain = estimatePricing({
      categoryGuess: "Women's dress",
      materials: ["cotton"],
      brandOrMaker: null,
      conditionNotes: "good",
      weightGrams: 400,
      lengthCm: 40,
      widthCm: 30,
      heightCm: 5,
      markupPercent: 45,
    });

    const premium = estimatePricing({
      categoryGuess: "Women's dress",
      materials: ["silk"],
      brandOrMaker: "Chanel",
      conditionNotes: "excellent, near mint",
      weightGrams: 400,
      lengthCm: 40,
      widthCm: 30,
      heightCm: 5,
      markupPercent: 45,
    });

    expect(premium.suggestedPrice).toBeGreaterThan(plain.suggestedPrice);
    expect(premium.currency).toBe("AUD");
  });

  it("estimates domestic shipping from weight", () => {
    const light = estimateShipping({
      categoryGuess: "Jewelry",
      materials: ["silver"],
      brandOrMaker: null,
      conditionNotes: "new",
      weightGrams: 50,
      lengthCm: 10,
      widthCm: 8,
      heightCm: 2,
    });
    const heavy = estimateShipping({
      categoryGuess: "Home decor",
      materials: ["ceramic"],
      brandOrMaker: null,
      conditionNotes: "good",
      weightGrams: 2000,
      lengthCm: 30,
      widthCm: 30,
      heightCm: 30,
    });
    expect(heavy.domesticShippingEstimate).toBeGreaterThan(light.domesticShippingEstimate);
    expect(heavy.internationalShippingEstimate).toBeGreaterThan(heavy.domesticShippingEstimate);
  });

  it("applies commercial assumptions onto a draft skeleton", () => {
    const draft = applyCommercialAssumptions({
      title: "Vintage silk scarf",
      description: "A lovely scarf",
      tags: ["silk", "scarf"],
      materials: ["silk"],
      categoryGuess: "Accessories > Scarves",
      taxonomyId: 1229,
      whoMade: "someone_else",
      whenMade: "2010_2019",
      isSupply: false,
      quantity: 1,
      sku: null,
      conditionNotes: "excellent",
      brandOrMaker: "Hermes",
      style: ["vintage"],
      occasion: null,
      recipient: "women",
      confidence: 0.8,
      assumptions: ["Maker mark visible"],
      photoGuidance: [],
      estimatedRetailHint: 120,
    });

    expect(draft.pricing.suggestedPrice).toBe(120);
    expect(draft.shipping.weightGrams).toBe(250);
    expect(draft.assumptions.length).toBeGreaterThan(1);
  });
});

describe("taxonomy guess", () => {
  it("maps common categories to taxonomy ids", () => {
    expect(guessTaxonomy("Jewelry", "Gold hoop earrings").taxonomyId).toBe(1201);
    expect(guessTaxonomy("Clothing", "Linen summer dress").taxonomyId).toBe(10915);
  });
});
