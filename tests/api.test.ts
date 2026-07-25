import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { config } from "../src/config/env.js";

const app = createApp();
const tmpRoot = path.join(process.cwd(), ".test-runtime");

async function writeTinyPng(filePath: string): Promise<void> {
  // 1x1 PNG
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  await fs.writeFile(filePath, png);
}

async function writeTinyMp4(filePath: string): Promise<void> {
  // Minimal placeholder bytes labeled as mp4 for upload path testing
  await fs.writeFile(filePath, Buffer.from("ftypisomfakevideo"));
}

describe("listing session API", () => {
  beforeAll(async () => {
    config.uploadDir = path.join(tmpRoot, "uploads");
    config.dataDir = path.join(tmpRoot, "data");
    await fs.mkdir(config.uploadDir, { recursive: true });
    await fs.mkdir(config.dataDir, { recursive: true });
    // Force fallback analyzer (no real OpenAI key)
    config.openaiApiKey = "";
  });

  afterAll(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("runs the full capture → analyze → edit → complete flow", async () => {
    const created = await request(app)
      .post("/api/v1/sessions")
      .send({ currency: "AUD", markupPercent: 40, whoMadeDefault: "someone_else" })
      .expect(201);

    expect(created.body.id).toBeTruthy();
    expect(created.body.status).toBe("awaiting_media");
    expect(created.body.captureGuide.photos).toHaveLength(5);

    const sessionId = created.body.id as string;
    const assets = path.join(tmpRoot, "assets");
    await fs.mkdir(assets, { recursive: true });

    const photoSlots = ["front", "back", "detail", "bottom_mark", "context"] as const;
    const files: string[] = [];
    for (const slot of photoSlots) {
      const p = path.join(assets, `${slot}.png`);
      await writeTinyPng(p);
      files.push(p);
    }
    const videoPath = path.join(assets, "walk.mp4");
    await writeTinyMp4(videoPath);
    files.push(videoPath);

    let req = request(app).post(`/api/v1/sessions/${sessionId}/media`);
    const slots = [...photoSlots, "video"];
    for (let i = 0; i < files.length; i++) {
      req = req.attach("files", files[i]);
    }
    req = req.field("slots", slots.join(","));

    const uploaded = await req.expect(200);
    expect(uploaded.body.status).toBe("ready_to_analyze");
    expect(uploaded.body.media).toHaveLength(6);
    expect(uploaded.body.missingMedia).toEqual([]);

    const analyzed = await request(app)
      .post(`/api/v1/sessions/${sessionId}/analyze`)
      .expect(200);

    expect(analyzed.body.status).toBe("draft_ready");
    expect(analyzed.body.draft.title).toBeTruthy();
    expect(analyzed.body.draft.pricing.suggestedPrice).toBeGreaterThan(0);
    expect(analyzed.body.draft.shipping.domesticShippingEstimate).toBeGreaterThan(0);
    expect(analyzed.body.draft.tags.length).toBeGreaterThan(0);

    const patched = await request(app)
      .patch(`/api/v1/sessions/${sessionId}/draft`)
      .send({
        title: "Vintage floral midi dress — size M",
        pricing: { suggestedPrice: 89.95 },
        taxonomyId: 10915,
      })
      .expect(200);

    expect(patched.body.draft.title).toContain("midi dress");
    expect(patched.body.draft.pricing.suggestedPrice).toBe(89.95);
    expect(patched.body.draft.taxonomyId).toBe(10915);

    const completed = await request(app)
      .post(`/api/v1/sessions/${sessionId}/complete`)
      .expect(200);

    expect(completed.body.status).toBe("completed");
    expect(completed.body.etsy.state).toBe("local_only");
    expect(completed.body.etsy.listingId).toBeNull();
  });

  it("rejects analyze when media is incomplete", async () => {
    const created = await request(app).post("/api/v1/sessions").send({}).expect(201);
    const sessionId = created.body.id as string;

    await request(app)
      .post(`/api/v1/sessions/${sessionId}/analyze`)
      .expect(400);
  });

  it("reports health", async () => {
    const res = await request(app).get("/api/v1/health").expect(200);
    expect(res.body.ok).toBe(true);
  });
});
