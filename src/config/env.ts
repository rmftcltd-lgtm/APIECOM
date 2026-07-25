import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function floatEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: intEnv("PORT", 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o",
  etsyApiKey: process.env.ETSY_API_KEY ?? "",
  etsyAccessToken: process.env.ETSY_ACCESS_TOKEN ?? "",
  etsyShopId: process.env.ETSY_SHOP_ID ?? "",
  etsyShippingProfileId: process.env.ETSY_SHIPPING_PROFILE_ID ?? "",
  etsyReturnPolicyId: process.env.ETSY_RETURN_POLICY_ID ?? "",
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? "AUD",
  defaultCountry: process.env.DEFAULT_COUNTRY ?? "AU",
  defaultMarkupPercent: floatEnv("DEFAULT_MARKUP_PERCENT", 45),
  defaultBaseShipping: floatEnv("DEFAULT_BASE_SHIPPING", 8.5),
  defaultWeightShippingPerKg: floatEnv("DEFAULT_WEIGHT_SHIPPING_PER_KG", 6),
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? "./uploads"),
  dataDir: path.resolve(process.env.DATA_DIR ?? "./data"),
  maxPhotoBytes: intEnv("MAX_PHOTO_BYTES", 10 * 1024 * 1024),
  maxVideoBytes: intEnv("MAX_VIDEO_BYTES", 50 * 1024 * 1024),
};

export function etsyConfigured(): boolean {
  return Boolean(
    config.etsyApiKey && config.etsyAccessToken && config.etsyShopId,
  );
}
