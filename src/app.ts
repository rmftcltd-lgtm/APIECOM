import path from "node:path";
import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/api.js";
import { asyncErrorAwareHandler } from "./middleware/zodError.js";
import { config } from "./config/env.js";

const publicDir = path.resolve(process.cwd(), "public");

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.static(publicDir));
  app.use("/uploads", express.static(config.uploadDir));
  app.use("/api/v1", apiRouter);
  app.get("/", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
  app.use(asyncErrorAwareHandler);
  return app;
}
