import fs from "node:fs/promises";
import path from "node:path";
import { config, etsyConfigured } from "../config/env.js";
import type { CaptureSession, ListingDraft } from "../types/listing.js";

export interface EtsyPublishResult {
  listingId: number | null;
  state: "draft" | "local_only";
  url: string | null;
  message: string;
}

interface EtsyListingResponse {
  listing_id: number;
  url?: string;
  state?: string;
}

async function etsyFetch(
  pathname: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-api-key", config.etsyApiKey);
  headers.set("Authorization", `Bearer ${config.etsyAccessToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`https://openapi.etsy.com/v3/application${pathname}`, {
    ...init,
    headers,
  });
}

export async function createEtsyDraftListing(
  session: CaptureSession,
  draft: ListingDraft,
): Promise<EtsyPublishResult> {
  if (!etsyConfigured()) {
    return {
      listingId: null,
      state: "local_only",
      url: null,
      message:
        "Etsy credentials not configured. Draft saved locally — set ETSY_API_KEY, ETSY_ACCESS_TOKEN, and ETSY_SHOP_ID to publish.",
    };
  }

  if (!draft.taxonomyId) {
    return {
      listingId: null,
      state: "local_only",
      url: null,
      message:
        "taxonomyId is required to create an Etsy listing. Set it on the draft before completing.",
    };
  }

  const body: Record<string, unknown> = {
    quantity: draft.quantity,
    title: draft.title.slice(0, 140),
    description: draft.description,
    price: draft.pricing.suggestedPrice.toFixed(2),
    who_made: draft.whoMade,
    when_made: draft.whenMade,
    taxonomy_id: draft.taxonomyId,
    is_supply: draft.isSupply,
    type: "physical",
    should_auto_renew: true,
    tags: draft.tags.slice(0, 13),
    materials: draft.materials.slice(0, 13),
    item_weight: draft.shipping.weightGrams,
    item_weight_unit: "g",
    item_length: draft.shipping.lengthCm,
    item_width: draft.shipping.widthCm,
    item_height: draft.shipping.heightCm,
    item_dimensions_unit: "cm",
  };

  if (config.etsyShippingProfileId) {
    body.shipping_profile_id = Number(config.etsyShippingProfileId);
  }
  if (config.etsyReturnPolicyId) {
    body.return_policy_id = Number(config.etsyReturnPolicyId);
  }
  if (draft.sku) body.sku = draft.sku;
  if (draft.style.length) body.style = draft.style.slice(0, 2);
  if (draft.recipient) body.recipient = draft.recipient;
  if (draft.occasion) body.occasion = draft.occasion;

  const createRes = await etsyFetch(`/shops/${config.etsyShopId}/listings`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Etsy create listing failed (${createRes.status}): ${errText}`);
  }

  const listing = (await createRes.json()) as EtsyListingResponse;
  const photos = session.media
    .filter((m) => m.slot !== "video")
    .sort((a, b) => {
      const order = ["front", "back", "detail", "bottom_mark", "context"];
      return order.indexOf(a.slot) - order.indexOf(b.slot);
    });

  let rank = 1;
  for (const photo of photos) {
    const bytes = await fs.readFile(photo.path);
    const form = new FormData();
    const blob = new Blob([bytes], { type: photo.mimeType });
    form.append("image", blob, path.basename(photo.filename));
    form.append("rank", String(rank));
    form.append("overwrite", "true");

    const imgRes = await etsyFetch(`/listings/${listing.listing_id}/images`, {
      method: "POST",
      body: form,
    });
    if (!imgRes.ok) {
      const errText = await imgRes.text();
      throw new Error(
        `Etsy image upload failed for ${photo.slot} (${imgRes.status}): ${errText}`,
      );
    }
    rank += 1;
  }

  return {
    listingId: listing.listing_id,
    state: "draft",
    url: listing.url ?? `https://www.etsy.com/listing/${listing.listing_id}`,
    message: "Draft listing created on Etsy. Review and activate in Seller Hub.",
  };
}
