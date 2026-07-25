import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/api.js";
import { asyncErrorAwareHandler } from "./middleware/zodError.js";
import { config } from "./config/env.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use("/uploads", express.static(config.uploadDir));
  app.use("/api/v1", apiRouter);
  app.use(asyncErrorAwareHandler);
  return app;
}
