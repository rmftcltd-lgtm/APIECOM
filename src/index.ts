import fs from "node:fs";
import { createApp } from "./app.js";
import { config } from "./config/env.js";

fs.mkdirSync(config.uploadDir, { recursive: true });
fs.mkdirSync(config.dataDir, { recursive: true });

const app = createApp();

app.listen(config.port, () => {
  console.log(`Etsy listing automation API listening on http://localhost:${config.port}`);
  console.log(`Health: GET /api/v1/health`);
});
